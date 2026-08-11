from django.core.mail import send_mail
import os
import json
import secrets
from urllib import parse, request as urllib_request
from django.core.cache import cache
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
# --- Password Reset Request Endpoint ---
@api_view(['POST'])
def auth_password_reset_request_view(request):
    """
    Request a password reset link.
    Expects: { email: string }
    Returns: { success: bool, message: string }
    """
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'success': False, 'message': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    user = UserAccount.objects.filter(email=email).first()
    if user:
        # Generate a reset token (in production, store this in DB and expire it)
        reset_token = secrets.token_urlsafe(32)
        reset_link = f"http://localhost:5173/reset-password/{reset_token}"
        send_mail('Password Reset', f'Click to reset your password: {reset_link}', settings.DEFAULT_FROM_EMAIL, [email])
    # Always return success for security
    return Response({'success': True, 'message': 'If this email exists, a reset link will be sent.'})

from .serializers import UserAccountSerializer
# --- Profile Update Endpoint ---
from rest_framework.permissions import IsAuthenticated

@api_view(['POST'])
def auth_update_profile_view(request):
    """
    Update user profile details
    Expects optional fields:
    {
        full_name?: string,
        username?: string,
        email?: string,
        school_level?: string,
        school_name?: string,
        client_type?: string,
        sex?: string,
        age?: string,
        region?: string,
        category?: string
    }
    Requires: Authorization: Bearer <session_token>
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return Response({'success': False, 'message': 'No session token provided'}, status=status.HTTP_401_UNAUTHORIZED)
    session_token = auth_header[7:]
    session = Session.find_by_token(session_token)
    if not session or not session.user:
        return Response({'success': False, 'message': 'Invalid or expired session'}, status=status.HTTP_401_UNAUTHORIZED)

    user = session.user
    data = request.data

    new_username = data.get('username', '').strip()
    new_full_name = data.get('full_name', '').strip()
    new_email = data.get('email', '').strip().lower()

    # Check if username is changing and unique
    if new_username and new_username != user.username:
        if UserAccount.objects.filter(username=new_username).exclude(id=user.id).exists():
            return Response({'success': False, 'message': 'Username already taken'}, status=status.HTTP_400_BAD_REQUEST)
        user.username = new_username

    # Check if email is changing and unique
    if new_email and new_email != user.email:
        if UserAccount.objects.filter(email=new_email).exclude(id=user.id).exists():
            return Response({'success': False, 'message': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)
        user.email = new_email

    if new_full_name:
        user.full_name = new_full_name

    # Optional profile fields used by registration and CSM autofill
    if 'school_level' in data:
        school_level = (data.get('school_level') or '').strip()
        if school_level and not _is_valid_choice(school_level, ALLOWED_SCHOOL_LEVELS):
            return Response({'success': False, 'message': 'Invalid school level selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.school_level = school_level or None
    if 'school_name' in data:
        user.school_name = (data.get('school_name') or '').strip() or None
    if 'client_type' in data:
        client_type = _normalize_client_type(data.get('client_type'), data.get('client_type_other'))
        if (data.get('client_type') or '').strip() == 'Others' and not client_type:
            return Response({'success': False, 'message': 'Client type details are required when Others is selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.client_type = client_type or None
    if 'sex' in data:
        sex = (data.get('sex') or '').strip()
        if sex and not _is_valid_choice(sex, ALLOWED_SEX):
            return Response({'success': False, 'message': 'Invalid sex selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.sex = sex or None
    if 'age' in data:
        age = (data.get('age') or '').strip()
        if age and not _is_valid_choice(age, ALLOWED_AGE):
            return Response({'success': False, 'message': 'Invalid age range selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.age = age or None
    if 'region' in data:
        region = (data.get('region') or '').strip()
        if region and not _is_valid_choice(region, ALLOWED_REGION):
            return Response({'success': False, 'message': 'Invalid region selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.region = region or None
    if 'category' in data:
        category = (data.get('category') or '').strip()
        if category and not _is_valid_choice(category, ALLOWED_CATEGORY):
            return Response({'success': False, 'message': 'Invalid user category selected'}, status=status.HTTP_400_BAD_REQUEST)
        user.category = category or None

    user.save()
    serializer = UserAccountSerializer(user)
    return Response({'success': True, 'user': serializer.data})
"""
Authentication Views for LitPath AI
Handles login, logout, guest sessions, and session validation
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import UserAccount, Session, UserRole, CSMFeedback
from .password_validation import validate_password_strength


CURRENT_TERMS_VERSION = os.getenv('TERMS_VERSION', 'v2026-04-01')
REGISTER_RATE_LIMIT = int(os.getenv('REGISTER_RATE_LIMIT', '10'))
REGISTER_RATE_WINDOW_SECONDS = int(os.getenv('REGISTER_RATE_WINDOW_SECONDS', '3600'))
REQUIRE_CAPTCHA = os.getenv('REQUIRE_CAPTCHA', 'false').lower() == 'true'
RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY', '')
CAPTCHA_VERIFY_URL = os.getenv('CAPTCHA_VERIFY_URL', 'https://www.google.com/recaptcha/api/siteverify')

ALLOWED_SCHOOL_LEVELS = {
    'Junior High School',
    'Senior High School',
    'Undergraduate',
    'Graduate',
    'Postgraduate'
}
ALLOWED_CLIENT_TYPES = {choice[0] for choice in CSMFeedback.CLIENT_TYPE_CHOICES}
ALLOWED_CLIENT_TYPE_BASE = {choice[0] for choice in CSMFeedback.CLIENT_TYPE_CHOICES if choice[0] != 'Others'}
ALLOWED_SEX = {choice[0] for choice in CSMFeedback.SEX_CHOICES}
ALLOWED_AGE = {choice[0] for choice in CSMFeedback.AGE_CHOICES}
ALLOWED_REGION = {choice[0] for choice in CSMFeedback.REGION_CHOICES}
ALLOWED_CATEGORY = {choice[0] for choice in CSMFeedback.CATEGORY_CHOICES}


def _is_valid_choice(value, allowed_values):
    return value in allowed_values


def _normalize_client_type(client_type, client_type_other=''):
    selected_client_type = (client_type or '').strip()
    custom_client_type = (client_type_other or '').strip()

    if selected_client_type == 'Others':
        return custom_client_type or None

    if selected_client_type in ALLOWED_CLIENT_TYPE_BASE:
        return selected_client_type

    return selected_client_type or None


def _client_ip(request_obj):
    xff = request_obj.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request_obj.META.get('REMOTE_ADDR', 'unknown')


def _register_rate_limited(request_obj):
    ip = _client_ip(request_obj)
    key = f"auth_register_rate:{ip}"

    count = cache.get(key)
    if count is None:
        cache.set(key, 1, REGISTER_RATE_WINDOW_SECONDS)
        return False

    if int(count) >= REGISTER_RATE_LIMIT:
        return True

    try:
        cache.incr(key)
    except Exception:
        cache.set(key, int(count) + 1, REGISTER_RATE_WINDOW_SECONDS)

    return False


def _verify_captcha(captcha_token, client_ip):
    if not REQUIRE_CAPTCHA:
        return True, None

    if not RECAPTCHA_SECRET_KEY:
        return False, 'CAPTCHA is temporarily unavailable. Please try again later.'

    if not captcha_token:
        return False, 'CAPTCHA verification failed. Please try again.'

    try:
        payload = parse.urlencode({
            'secret': RECAPTCHA_SECRET_KEY,
            'response': captcha_token,
            'remoteip': client_ip,
        }).encode('utf-8')

        req = urllib_request.Request(CAPTCHA_VERIFY_URL, data=payload, method='POST')
        with urllib_request.urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read().decode('utf-8'))

        if body.get('success'):
            return True, None
        return False, 'CAPTCHA verification failed. Please try again.'
    except Exception:
        return False, 'CAPTCHA verification failed. Please try again.'


@api_view(['POST'])
def auth_login_view(request):
    """
    Login endpoint for authenticated users
    Expects: { email: string, password: string }
    Returns: { success: bool, user: object, session: object }
    """
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    
    if not email or not password:
        return Response({
            'success': False,
            'message': 'Email and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Find user by email
        user = UserAccount.objects.filter(email=email).first()
        
        if not user:
            return Response({
                'success': False,
                'message': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Verify password
        if not user.check_password(password):
            return Response({
                'success': False,
                'message': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Block login for inactive accounts
        if not user.is_active:
            return Response({
                'success': False,
                'message': 'Account is inactive'
            }, status=status.HTTP_403_FORBIDDEN)

        # Update last login
        user.update_last_login()

        # Create new session
        session = Session.create_for_user(user)
        
        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'school_level': user.school_level,
                'school_name': user.school_name,
                'client_type': user.client_type,
                'sex': user.sex,
                'age': user.age,
                'region': user.region,
                'category': user.category,
                'terms_version': user.terms_version
            },
            'session': {
                'session_id': session.id,
                'session_token': getattr(session, 'public_session_token', session.session_token),
                'created_at': session.created_at.isoformat(),
                'is_anonymous': False
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return Response({
            'success': False,
            'message': 'An error occurred during login'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def auth_register_view(request):
    """
    Register a new user account
    Expects: {
        email: string,
        password: string,
        username: string,
        full_name?: string,
        school_level: string,
        school_name: string,
        client_type: string,
        sex: string,
        age: string,
        region: string,
        category: string,
        terms_accepted: boolean,
        terms_version?: string,
        captcha_token?: string
    }
    Returns: { success: bool, user: object, session: object }
    """
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    username = request.data.get('username', '').strip()
    full_name = request.data.get('full_name', '').strip()
    school_level = request.data.get('school_level', '').strip()
    school_name = request.data.get('school_name', '').strip()
    client_type = request.data.get('client_type', '').strip()
    client_type_other = request.data.get('client_type_other', '').strip()
    sex = request.data.get('sex', '').strip()
    age = request.data.get('age', '').strip()
    region = request.data.get('region', '').strip()
    category = request.data.get('category', '').strip()
    terms_accepted = request.data.get('terms_accepted', False)
    terms_version = (request.data.get('terms_version') or CURRENT_TERMS_VERSION).strip() or CURRENT_TERMS_VERSION
    captcha_token = request.data.get('captcha_token', '')

    if _register_rate_limited(request):
        return Response({
            'success': False,
            'message': 'Too many registration attempts. Please try again later.'
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)

    captcha_ok, captcha_error = _verify_captcha(captcha_token, _client_ip(request))
    if not captcha_ok:
        return Response({
            'success': False,
            'message': captcha_error
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not email or not password or not username or not client_type or not sex or not age or not region:
        return Response({
            'success': False,
            'message': 'Email, password, username, client type, and CSM profile fields are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not terms_accepted:
        return Response({
            'success': False,
            'message': 'You must accept the Terms and Conditions to sign up'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    is_valid_password, password_error = validate_password_strength(password)
    if not is_valid_password:
        return Response({
            'success': False,
            'message': password_error
        }, status=status.HTTP_400_BAD_REQUEST)

    normalized_client_type = _normalize_client_type(client_type, client_type_other)
    if client_type == 'Others' and not normalized_client_type:
        return Response({'success': False, 'message': 'Client type details are required when Others is selected'}, status=status.HTTP_400_BAD_REQUEST)
    if client_type == 'Student':
        if not school_level or not school_name:
            return Response({'success': False, 'message': 'School level and school name are required for students'}, status=status.HTTP_400_BAD_REQUEST)
        if not _is_valid_choice(school_level, ALLOWED_SCHOOL_LEVELS):
            return Response({'success': False, 'message': 'Invalid school level selected'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        school_level = ''
        school_name = ''
    if not _is_valid_choice(sex, ALLOWED_SEX):
        return Response({'success': False, 'message': 'Invalid sex selected'}, status=status.HTTP_400_BAD_REQUEST)
    if not _is_valid_choice(age, ALLOWED_AGE):
        return Response({'success': False, 'message': 'Invalid age range selected'}, status=status.HTTP_400_BAD_REQUEST)
    if not _is_valid_choice(region, ALLOWED_REGION):
        return Response({'success': False, 'message': 'Invalid region selected'}, status=status.HTTP_400_BAD_REQUEST)
    if category and not _is_valid_choice(category, ALLOWED_CATEGORY):
        return Response({'success': False, 'message': 'Invalid user category selected'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Check if email already exists
        if UserAccount.objects.filter(email=email).exists():
            return Response({
                'success': False,
                'message': 'Email already registered'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if username already exists
        if UserAccount.objects.filter(username=username).exists():
            return Response({
                'success': False,
                'message': 'Username already taken'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create new user
        user = UserAccount(
            email=email,
            username=username,
            full_name=full_name or username,
            school_level=school_level,
            school_name=school_name,
            client_type=normalized_client_type,
            sex=sex,
            age=age,
            region=region,
            category=category,
            terms_accepted=True,
            terms_accepted_at=timezone.now(),
            terms_version=terms_version,
            role=UserRole.USER
        )
        user.set_password(password)
        user.save()
        
        # Create session for new user
        session = Session.create_for_user(user)
        
        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'school_level': user.school_level,
                'school_name': user.school_name,
                'client_type': user.client_type,
                'sex': user.sex,
                'age': user.age,
                'region': user.region,
                'category': user.category,
                'terms_version': user.terms_version
            },
            'session': {
                'session_id': session.id,
                'session_token': getattr(session, 'public_session_token', session.session_token),
                'created_at': session.created_at.isoformat(),
                'is_anonymous': False
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print(f"Registration error: {e}")
        return Response({
            'success': False,
            'message': 'An error occurred during registration'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def auth_guest_session_view(request):
    """
    Create a guest session for anonymous users
    Returns: { success: bool, session: object }
    """
    try:
        # Create guest session
        session = Session.create_guest_session()
        
        return Response({
            'success': True,
            'session': {
                'session_id': session.id,
                'session_token': getattr(session, 'public_session_token', session.session_token),
                'guest_id': session.guest_id,
                'created_at': session.created_at.isoformat(),
                'is_anonymous': True
            }
        })
        
    except Exception as e:
        print(f"Guest session error: {e}")
        return Response({
            'success': False,
            'message': 'An error occurred creating guest session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def auth_validate_session_view(request):
    """
    Validate an existing session
    Expects: { session_id: int } or { session_token: string }
    Returns: { valid: bool, user?: object }
    """
    session_id = request.data.get('session_id')
    session_token = request.data.get('session_token')
    
    if not session_id and not session_token:
        return Response({
            'valid': False,
            'message': 'Session ID or token required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Find session
        if session_token:
            session = Session.find_by_token(session_token)
        else:
            session = Session.objects.filter(id=session_id).first()
        
        if not session:
            return Response({'valid': False})
        
        # Check if session is expired (24 hours for guests, 7 days for authenticated)
        expiry_hours = 24 if session.is_anonymous else 168  # 7 days
        if session.is_expired(hours=expiry_hours):
            session.delete()
            return Response({'valid': False})
        
        # Update activity
        session.update_activity()
        
        # Return user info if authenticated
        if session.user:
            return Response({
                'valid': True,
                'user': {
                    'id': session.user.id,
                    'email': session.user.email,
                    'username': session.user.username,
                    'full_name': session.user.full_name,
                    'role': session.user.role
                },
                'session': {
                    'session_id': session.id,
                    'is_anonymous': False
                }
            })
        else:
            return Response({
                'valid': True,
                'session': {
                    'session_id': session.id,
                    'guest_id': session.guest_id,
                    'is_anonymous': True
                }
            })
        
    except Exception as e:
        print(f"Session validation error: {e}")
        return Response({'valid': False})


@api_view(['POST'])
def auth_logout_view(request):
    """
    Logout and invalidate session
    Expects: { session_id: int } or { session_token: string }
    """
    session_id = request.data.get('session_id')
    session_token = request.data.get('session_token')
    
    try:
        if session_token:
            Session.delete_by_token(session_token)
        elif session_id:
            Session.objects.filter(id=session_id).delete()
        
        return Response({'success': True})
        
    except Exception as e:
        print(f"Logout error: {e}")
        return Response({'success': True})  # Always return success for logout


@api_view(['POST'])
def auth_delete_guest_data_view(request):
    """
    Delete all data associated with a guest session (for privacy on public devices)
    Expects: { guest_id: string } or { session_token: string }
    """
    guest_id = request.data.get('guest_id')
    session_token = request.data.get('session_token')
    
    try:
        # Find the session
        session = None
        if session_token:
            session = Session.find_by_token(session_token, is_anonymous=True)
        elif guest_id:
            session = Session.objects.filter(guest_id=guest_id, is_anonymous=True).first()
        
        if session:
            guest_identifier = session.guest_id
            
            # Import here to avoid circular imports
            from .models import Bookmark, ResearchHistory, Feedback
            
            # Delete all guest data
            Bookmark.objects.filter(user_id=guest_identifier).delete()
            ResearchHistory.objects.filter(user_id=guest_identifier).delete()
            Feedback.objects.filter(user_id=guest_identifier).delete()
            
            # Delete the session
            session.delete()
            
            return Response({
                'success': True,
                'message': 'Guest data deleted successfully'
            })
        
        return Response({
            'success': True,
            'message': 'No guest session found'
        })
        
    except Exception as e:
        print(f"Delete guest data error: {e}")
        return Response({
            'success': False,
            'message': 'An error occurred'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def auth_me_view(request):
    """
    Get current user info from session token
    Expects: Authorization header with session token
    """
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return Response({
            'authenticated': False,
            'message': 'No session token provided'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    session_token = auth_header[7:]  # Remove 'Bearer ' prefix
    
    try:
        session = Session.find_by_token(session_token)
        
        if not session:
            return Response({
                'authenticated': False,
                'message': 'Invalid session'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check expiry
        expiry_hours = 24 if session.is_anonymous else 168
        if session.is_expired(hours=expiry_hours):
            session.delete()
            return Response({
                'authenticated': False,
                'message': 'Session expired'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Update activity
        session.update_activity()
        
        if session.user:
            return Response({
                'authenticated': True,
                'user': {
                    'id': session.user.id,
                    'email': session.user.email,
                    'username': session.user.username,
                    'full_name': session.user.full_name,
                    'role': session.user.role,
                    'school_level': session.user.school_level,
                    'school_name': session.user.school_name,
                    'client_type': session.user.client_type,
                    'sex': session.user.sex,
                    'age': session.user.age,
                    'region': session.user.region,
                    'category': session.user.category,
                    'terms_version': session.user.terms_version
                },
                'is_guest': False
            })
        else:
            return Response({
                'authenticated': True,
                'user': {
                    'id': session.guest_id,
                    'username': 'Guest',
                    'role': 'guest'
                },
                'is_guest': True
            })
            
    except Exception as e:
        print(f"Auth me error: {e}")
        return Response({
            'authenticated': False,
            'message': 'An error occurred'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def auth_change_password_view(request):
    """
    Change password for authenticated user
    Expects: { user_id: int, current_password: string, new_password: string }
    Returns: { success: bool, message: string }
    """
    user_id = request.data.get('user_id')
    current_password = request.data.get('current_password', '')
    new_password = request.data.get('new_password', '')
    confirm_password = request.data.get('confirm_password', '')
    
    if not user_id or not current_password or not new_password:
        return Response({
            'success': False,
            'message': 'User ID, current password, and new password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    if confirm_password and new_password != confirm_password:
        return Response({
            'success': False,
            'message': 'New passwords do not match'
        }, status=status.HTTP_400_BAD_REQUEST)

    if current_password == new_password:
        return Response({
            'success': False,
            'message': 'New password must be different from current password'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    is_valid_password, password_error = validate_password_strength(new_password)
    if not is_valid_password:
        return Response({
            'success': False,
            'message': password_error
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Find user
        user = UserAccount.objects.filter(id=user_id).first()
        
        if not user:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({
                'success': False,
                'message': 'Current password is incorrect'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Update password
        user.set_password(new_password)
        user.save()

        # Invalidate any active sessions for this user after the password change.
        Session.objects.filter(user=user).delete()
        
        return Response({
            'success': True,
            'message': 'Password changed successfully'
        })
        
    except Exception as e:
        print(f"Change password error: {e}")
        return Response({
            'success': False,
            'message': 'An error occurred while changing password'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def auth_reset_password_view(request):
    """
    Reset password using a token
    Expects: { token: string, password: string }
    Returns: { success: bool, message: string }
    """
    token = request.data.get('token', '')
    password = request.data.get('password', '')
    if not token or not password:
        return Response({'success': False, 'message': 'Token and new password are required'}, status=status.HTTP_400_BAD_REQUEST)
    # For demo: store tokens in memory (in production, use DB)
    # We'll use a simple in-memory dict for this session
    if not hasattr(auth_reset_password_view, 'token_map'):
        auth_reset_password_view.token_map = {}
    token_map = auth_reset_password_view.token_map
    # Find user by token (simulate DB lookup)
    user = None
    for u in UserAccount.objects.all():
        if hasattr(u, 'reset_token') and u.reset_token == token:
            user = u
            break
    if not user:
        return Response({'success': False, 'message': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
    is_valid_password, password_error = validate_password_strength(password)
    if not is_valid_password:
        return Response({'success': False, 'message': password_error}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(password)
    user.save()
    # Remove token after use
    delattr(user, 'reset_token')
    return Response({'success': True, 'message': 'Password reset successful'})
