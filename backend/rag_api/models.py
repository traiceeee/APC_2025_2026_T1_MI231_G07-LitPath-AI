from django.db import models
from django.utils import timezone
from datetime import timedelta
import uuid
import hashlib
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.postgres.fields import ArrayField

# Models for LitPath AI - Unified User Account System


class UserRole(models.TextChoices):
    """User role choices"""
    GUEST = 'guest', 'Guest'
    USER = 'user', 'User'
    STAFF = 'staff', 'Staff'
    ADMIN = 'admin', 'Admin'


class UserAccount(models.Model):
    """
    Unified user accounts - combines regular users and staff/admin
    Matches schema: User_Accounts table
    """
    id = models.AutoField(primary_key=True, db_column='user_ID')
    email = models.EmailField(unique=True, max_length=50, db_column='user_email')
    password_hash = models.CharField(max_length=200, db_column='user_password_hash')
    full_name = models.CharField(max_length=100, blank=True, null=True, db_column='user_full_name')
    username = models.CharField(max_length=50, unique=True, db_column='user_username')
    school_level = models.CharField(max_length=50, blank=True, null=True, db_column='user_school_level')
    school_name = models.CharField(max_length=255, blank=True, null=True, db_column='user_school_name')
    client_type = models.CharField(max_length=50, blank=True, null=True, db_column='user_client_type')
    sex = models.CharField(max_length=50, blank=True, null=True, db_column='user_sex')
    age = models.CharField(max_length=50, blank=True, null=True, db_column='user_age')
    region = models.CharField(max_length=50, blank=True, null=True, db_column='user_region')
    category = models.CharField(max_length=100, blank=True, null=True, db_column='user_category')
    terms_accepted = models.BooleanField(default=False, db_column='user_terms_accepted')
    terms_accepted_at = models.DateTimeField(blank=True, null=True, db_column='user_terms_accepted_at')
    terms_version = models.CharField(max_length=50, blank=True, null=True, db_column='user_terms_version')
    created_at = models.DateTimeField(auto_now_add=True, db_column='user_created_at')
    last_login = models.DateTimeField(blank=True, null=True, db_column='user_last_login')
    role = models.CharField(
        max_length=50, 
        choices=UserRole.choices, 
        default=UserRole.USER,
        db_column='user_role'
    )
    is_active = models.BooleanField(default=True, db_column='user_is_active')
    
    class Meta:
        db_table = 'user_accounts'
        ordering = ['-created_at']
    
    def set_password(self, raw_password):
        """Hash and set password"""
        self.password_hash = make_password(raw_password)
    
    def check_password(self, raw_password):
        """Verify password"""
        return check_password(raw_password, self.password_hash)
    
    def update_last_login(self):
        """Update last login timestamp"""
        self.last_login = timezone.now()
        self.save(update_fields=['last_login'])
    
    def is_staff_or_admin(self):
        """Check if user has staff or admin role"""
        return self.role in [UserRole.STAFF, UserRole.ADMIN]
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class Session(models.Model):
    """
    User sessions - tracks both authenticated and anonymous sessions
    Matches schema: Sessions table
    One-to-One relationship: Each user can only have ONE active session at a time
    """
    id = models.AutoField(primary_key=True, db_column='session_ID')
    is_anonymous = models.BooleanField(default=False, db_column='session_is_anonymous')
    created_at = models.DateTimeField(auto_now_add=True, db_column='session_created_at')
    last_seen = models.DateTimeField(auto_now=True, db_column='session_last_seen')
    user = models.OneToOneField(
        UserAccount, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='session',
        db_column='USERS_ACCOUNTS_user_ID'
    )
    # Guest identifier for anonymous sessions
    guest_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    # Session token for validation
    session_token = models.CharField(max_length=255, unique=True, db_index=True)
    
    class Meta:
        db_table = 'sessions'
        ordering = ['-created_at']
    
    def is_expired(self, hours=24):
        """Check if session is older than specified hours"""
        expiry_time = self.last_seen + timedelta(hours=hours)
        return timezone.now() > expiry_time
    
    def update_activity(self):
        """Update last seen timestamp"""
        self.last_seen = timezone.now()
        self.save(update_fields=['last_seen'])

    @staticmethod
    def hash_token(raw_token):
        """Return a deterministic hash used for token-at-rest storage."""
        return hashlib.sha256((raw_token or '').encode('utf-8')).hexdigest()

    @classmethod
    def find_by_token(cls, raw_token, **filters):
        """Find session by hashed token, with plaintext fallback for legacy rows."""
        if not raw_token:
            return None
        queryset = cls.objects.filter(**filters)
        hashed = cls.hash_token(raw_token)
        session = queryset.filter(session_token=hashed).first()
        if session:
            return session
        return queryset.filter(session_token=raw_token).first()

    @classmethod
    def delete_by_token(cls, raw_token, **filters):
        """Delete session by token, supporting hashed and legacy plaintext rows."""
        if not raw_token:
            return 0
        queryset = cls.objects.filter(**filters)
        hashed = cls.hash_token(raw_token)
        deleted, _ = queryset.filter(session_token=hashed).delete()
        if deleted:
            return deleted
        deleted, _ = queryset.filter(session_token=raw_token).delete()
        return deleted
    
    @classmethod
    def create_for_user(cls, user):
        """Create a new session for an authenticated user (one-to-one)
        Deletes any existing session for this user first
        """
        import secrets
        # Delete existing session for this user (enforce one-to-one)
        cls.objects.filter(user=user).delete()
        
        raw_token = secrets.token_urlsafe(32)
        session = cls.objects.create(
            user=user,
            is_anonymous=False,
            session_token=cls.hash_token(raw_token)
        )
        session.public_session_token = raw_token
        return session
    
    @classmethod
    def create_guest_session(cls):
        """Create a new anonymous/guest session"""
        import secrets
        guest_id = f"guest_{int(timezone.now().timestamp())}_{secrets.token_hex(4)}"
        raw_token = secrets.token_urlsafe(32)
        session = cls.objects.create(
            user=None,
            is_anonymous=True,
            guest_id=guest_id,
            session_token=cls.hash_token(raw_token)
        )
        session.public_session_token = raw_token
        return session
    
    def __str__(self):
        if self.user:
            return f"Session for {self.user.username}"
        return f"Guest session {self.guest_id}"


# Keep legacy AdminUser for backward compatibility during migration
class AdminUser(models.Model):
    """
    DEPRECATED: Use UserAccount with role='admin' or role='staff' instead
    Kept for backward compatibility during migration
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    password = models.CharField(max_length=255)  # Will store hashed password
    full_name = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'admin_users'
        ordering = ['-created_at']
    
    def set_password(self, raw_password):
        """Hash and set password"""
        self.password = make_password(raw_password)
    
    def check_password(self, raw_password):
        """Verify password"""
        return check_password(raw_password, self.password)
    
    def __str__(self):
        return self.email


class SystemSettings(models.Model):
    """Singleton admin settings for AI, search, and environment configuration."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    ai_model_settings = models.JSONField(default=dict)
    search_settings = models.JSONField(default=dict)
    environment_config = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta:
        db_table = 'system_settings'

    @classmethod
    def get_solo(cls):
        from .system_settings import clone_default_system_settings

        defaults = clone_default_system_settings()
        settings, _ = cls.objects.get_or_create(
            id=1,
            defaults={
                'ai_model_settings': defaults['ai_model_settings'],
                'search_settings': defaults['search_settings'],
                'environment_config': defaults['environment_config'],
            },
        )
        return settings

    def __str__(self):
        return 'System settings'


class DatabaseStructureRecord(models.Model):
    """Tracks schema-level changes and migration history metadata."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    schema_version = models.CharField(max_length=50)
    migration_label = models.CharField(max_length=120, blank=True, null=True)
    change_summary = models.TextField(blank=True, null=True)
    rollback_script = models.TextField(blank=True, null=True)
    applied_at = models.DateTimeField(blank=True, null=True)
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='db_structures_created',
    )
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='db_structures_updated',
    )

    class Meta:
        db_table = 'database_structure_records'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.schema_version})"


class DatabaseBackupRecord(models.Model):
    """Stores database backup plans/history managed by IT administrators."""

    BACKUP_TYPE_CHOICES = [
        ('full', 'Full'),
        ('incremental', 'Incremental'),
        ('schema', 'Schema only'),
    ]

    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    backup_type = models.CharField(max_length=20, choices=BACKUP_TYPE_CHOICES, default='full')
    target_environment = models.CharField(max_length=60, blank=True, null=True)
    storage_location = models.CharField(max_length=255)
    retention_days = models.PositiveIntegerField(default=30)
    size_mb = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    notes = models.TextField(blank=True, null=True)
    backup_started_at = models.DateTimeField(blank=True, null=True)
    backup_completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='db_backups_created',
    )
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='db_backups_updated',
    )

    class Meta:
        db_table = 'database_backup_records'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        return f"{self.name} [{self.backup_type}]"


class SecurityAuthenticationPolicy(models.Model):
    """Tracks authentication policy rules and security posture settings."""

    AUTH_MODE_CHOICES = [
        ('password', 'Password only'),
        ('password_mfa', 'Password + MFA'),
        ('sso', 'Single sign-on'),
        ('hybrid', 'Hybrid'),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    authentication_mode = models.CharField(max_length=30, choices=AUTH_MODE_CHOICES, default='password_mfa')
    password_min_length = models.PositiveSmallIntegerField(default=12)
    password_history_count = models.PositiveSmallIntegerField(default=5)
    session_timeout_minutes = models.PositiveIntegerField(default=60)
    max_failed_attempts = models.PositiveSmallIntegerField(default=5)
    lockout_minutes = models.PositiveIntegerField(default=15)
    require_mfa = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_auth_policies_created',
    )
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_auth_policies_updated',
    )

    class Meta:
        db_table = 'security_authentication_policies'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        return self.name


class SecurityAccessControlRule(models.Model):
    """Stores access-control rules for roles, users, or groups."""

    SUBJECT_TYPE_CHOICES = [
        ('role', 'Role'),
        ('user', 'User'),
        ('group', 'Group'),
    ]

    PERMISSION_LEVEL_CHOICES = [
        ('read', 'Read'),
        ('write', 'Write'),
        ('admin', 'Admin'),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPE_CHOICES, default='role')
    subject_name = models.CharField(max_length=150)
    resource_name = models.CharField(max_length=150)
    permission_level = models.CharField(max_length=20, choices=PERMISSION_LEVEL_CHOICES, default='read')
    scope = models.CharField(max_length=120, blank=True, null=True)
    conditions = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_access_rules_created',
    )
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_access_rules_updated',
    )

    class Meta:
        db_table = 'security_access_control_rules'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        return self.name


class SecurityAuditLogEntry(models.Model):
    """Stores security audit events for authentication and access control reviews."""

    EVENT_TYPE_CHOICES = [
        ('activity', 'Activity'),
        ('error', 'Error'),
        ('login_success', 'Login success'),
        ('login_failure', 'Login failure'),
        ('role_change', 'Role change'),
        ('access_change', 'Access change'),
        ('security_update', 'Security update'),
        ('manual_note', 'Manual note'),
    ]

    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    OUTCOME_CHOICES = [
        ('success', 'Success'),
        ('blocked', 'Blocked'),
        ('failure', 'Failure'),
    ]

    id = models.AutoField(primary_key=True)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES, default='manual_note')
    actor_label = models.CharField(max_length=150)
    target_label = models.CharField(max_length=150, blank=True, null=True)
    action_summary = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='info')
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default='success')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_audit_logs_created',
    )
    updated_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_audit_logs_updated',
    )

    class Meta:
        db_table = 'security_audit_log_entries'
        ordering = ['-occurred_at', '-updated_at', '-created_at']

    def __str__(self):
        return f"{self.event_type} - {self.actor_label}"


class Bookmark(models.Model):
    """User bookmarks for research papers - Auto-delete after 30 days"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=255, db_index=True)
    title = models.TextField()
    author = models.CharField(max_length=500, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    abstract = models.TextField(blank=True, null=True)
    file = models.CharField(max_length=500)
    degree = models.CharField(max_length=200, blank=True, null=True)
    subjects = models.TextField(blank=True, null=True)
    school = models.CharField(max_length=500, blank=True, null=True)
    bookmarked_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bookmarks'
        ordering = ['-bookmarked_at']
        unique_together = [['user_id', 'file']]
    
    def __str__(self):
        return f"{self.user_id}: {self.title}"


class ResearchHistory(models.Model):
    """User research session history"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.TextField(db_index=True)
    user_id = models.TextField(db_index=True)
    query = models.TextField()
    all_queries = models.JSONField(blank=True, null=True)
    conversation_data = models.JSONField(blank=True, null=True)
    sources_count = models.IntegerField(blank=True, null=True)
    conversation_length = models.IntegerField(blank=True, null=True)
    subjects = models.TextField(blank=True, null=True)
    date_filter = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    response_time_ms = models.FloatField(null=True, blank=True)  # milliseconds
    
    class Meta:
        db_table = 'research_history'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user_id}: {self.query[:50]}"


class Feedback(models.Model):
    """System Admin feedback"""
    # --- UPDATED CHOICES ---
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Reviewed', 'Reviewed'),
        ('Resolved', 'Resolved'), # Changed from Addressed
    ]
    
    CATEGORY_CHOICES = [
        ('Positive', 'Positive'),
        ('Issue', 'Issue'),
        ('For Improvement', 'For Improvement'),
    ]

    """User feedback"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.TextField(db_index=True)
    query = models.TextField(blank=True, null=True)
    rating = models.IntegerField(blank=True, null=True)
    relevant = models.BooleanField(blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    document_file = models.CharField(max_length=500, null=True, blank=True, db_index=True)

    # --- UPDATED TRIAGE FIELDS ---
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, null=True, blank=True)
    
    is_valid = models.BooleanField(null=True, blank=True)
    validity_remarks = models.TextField(blank=True, null=True)  # <--- NEW
    
    is_doable = models.BooleanField(null=True, blank=True)
    feasibility_remarks = models.TextField(blank=True, null=True) # <--- NEW
    
    class Meta:
        db_table = 'feedback'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user_id}: Rating {self.rating} ({self.status})"
    

class Material(models.Model):
    """Store metadata about theses/dissertations"""
    file = models.CharField(max_length=500, unique=True)
    title = models.TextField()
    author = models.TextField()
    year = models.IntegerField(null=True, blank=True)
    abstract = models.TextField(blank=True)
    degree = models.CharField(max_length=100, blank=True)
    subjects = ArrayField(
        models.CharField(max_length=200),
        blank=True,
        default=list
    )
    school = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'materials'
        indexes = [
            models.Index(fields=['file']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.year})"


class MaterialView(models.Model):
    """Track material views"""
    file = models.CharField(max_length=500, db_index=True)
    user_id = models.CharField(max_length=100, null=True, blank=True)
    session_id = models.CharField(max_length=100, null=True, blank=True)
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'material_views'
        indexes = [
            models.Index(fields=['file']),
            models.Index(fields=['-viewed_at']),
            models.Index(fields=['user_id']),
        ]
    
    def __str__(self):
        return f"View of {self.file} at {self.viewed_at}"

# =========================================================================
class CSMFeedback(models.Model):
    """
    Client Satisfaction Measurement (CSM) Feedback
    This stores the detailed survey form and Admin Triage data.
    """

    # Client Type choices (unified with Category)
    CLIENT_TYPE_CHOICES = [
        ('Student', 'Student'),
        ('DOST Employee', 'DOST Employee'),
        ('Other Government Employee', 'Other Government Employee'),
        ('Librarian/Library Staff', 'Librarian/Library Staff'),
        ('Teaching Personnel', 'Teaching Personnel'),
        ('Administrative Personnel', 'Administrative Personnel'),
        ('Researcher', 'Researcher'),
        ('Others', 'Others'),
    ]
    
    # Sex choices
    SEX_CHOICES = [
        ('Female', 'Female'),
        ('Male', 'Male'),
        ('Prefer not to say', 'Prefer not to say'),
    ]
    
    # Age choices
    AGE_CHOICES = [
        ('10 and below', '10 years old and below'),
        ('11-15', '11 - 15 years old'),
        ('16-20', '16 - 20 years old'),
        ('21-25', '21 - 25 years old'),
        ('26-30', '26 - 30 years old'),
        ('31-35', '31 - 35 years old'),
        ('36-40', '36 - 40 years old'),
        ('41-45', '41 - 45 years old'),
        ('46-50', '46 - 50 years old'),
        ('51-55', '51 - 55 years old'),
        ('56-60', '56 - 60 years old'),
        ('61 and above', '61 years old and above'),
    ]
    
    # Region choices
    REGION_CHOICES = [
        ('NCR', '[NCR] National Capital Region'),
        ('CAR', '[CAR] Cordillera Administrative Region'),
        ('R01', '[R01] Region 1 (Ilocos Region)'),
        ('R02', '[R02] Region 2 (Cagayan Valley Region)'),
        ('R03', '[R03] Region 3 (Central Luzon Region)'),
        ('R4A', '[R4A] Region 4A (CALABARZON Region)'),
        ('R4B', '[R4B] Region 4B (MIMAROPA Region)'),
        ('R05', '[R05] Region 5 (Bicol Region)'),
        ('R06', '[R06] Western Visayas Region'),
        ('R07', '[R07] Central Visayas Region'),
        ('R08', '[R08] Eastern Visayas Region'),
        ('R09', '[R09] Zamboanga Peninsula Region'),
        ('R10', '[R10] Northern Mindanao Region'),
        ('R11', '[R11] Davao Region'),
        ('R12', '[R12] SOCCSKSARGEN Region'),
        ('R13', '[R13] Caraga Administrative Region'),
        ('R18', '[R18] Negros Island Region (NIR)'),
        ('BARMM', '[BARMM] Bangsamoro Autonomous Region in Muslim Mindanao'),
        ('N/A', '[N/A] Not Applicable (Overseas)'),
    ]
    
    # Category choices
    CATEGORY_CHOICES = [
        ('Student', 'Student'),
        ('DOST Employee', 'DOST Employee'),
        ('Other Government Employee', 'Other Government Employee'),
        ('Librarian/Library Staff', 'Librarian/Library Staff'),
        ('Teaching Personnel', 'Teaching Personnel'),
        ('Administrative Personnel', 'Administrative Personnel'),
        ('Researcher', 'Researcher'),
    ]
    
    # Rating choices (1-Poor to 5-Excellent)
    RATING_CHOICES = [
        (1, '1 - Poor'),
        (2, '2 - Fair'),
        (3, '3 - Good'),
        (4, '4 - Very Good'),
        (5, '5 - Excellent'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.TextField(db_index=True)
    session_id = models.TextField(db_index=True, blank=True, null=True)
    
    # I. Data Privacy & Consent
    consent_given = models.BooleanField(default=False, db_index=True)
    
    # II. Client Profile
    client_type = models.CharField(max_length=50, choices=CLIENT_TYPE_CHOICES)
    date = models.DateField()
    sex = models.CharField(max_length=50, choices=SEX_CHOICES)
    age = models.CharField(max_length=50, choices=AGE_CHOICES)
    region = models.CharField(max_length=50, choices=REGION_CHOICES)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES, blank=True, null=True)
    
    # Conditional fields for client type
    school_level = models.CharField(max_length=100, blank=True, null=True, 
        help_text="For Student client type")
    school_name = models.CharField(max_length=255, blank=True, null=True,
        help_text="For Student client type")
    client_type_other = models.CharField(max_length=255, blank=True, null=True,
        help_text="Required when client type is Others")
    company = models.CharField(max_length=255, blank=True, null=True,
        help_text="Optional organization or affiliation")
    
    # III. Feedback & Evaluation
    litpath_rating = models.IntegerField(choices=RATING_CHOICES, blank=True, null=True)
    research_interests = models.TextField(blank=True, null=True)
    missing_content = models.TextField(blank=True, null=True)
    message_comment = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    
    # NEW FIELDS: Admin Triage & Management
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Reviewed', 'Reviewed'),
        ('Resolved', 'Resolved'),
    ]
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    
    # Admin Classification
    admin_category = models.CharField(max_length=100, blank=True, null=True, 
        help_text="e.g. Bug, Feature Request, Content Request, Compliment")
    
    # Validity Check
    is_valid = models.BooleanField(null=True, blank=True)
    validity_remarks = models.TextField(blank=True, null=True)
    
    # Feasibility Check
    is_doable = models.BooleanField(null=True, blank=True)
    feasibility_remarks = models.TextField(blank=True, null=True)

    # Edit audit trail
    last_edited_by = models.ForeignKey(
        UserAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='edited_csm_feedback',
    )
    last_edited_at = models.DateTimeField(null=True, blank=True, db_index=True)
    edit_history = models.JSONField(default=list, blank=True)
    
    class Meta:
        db_table = 'csm_feedback'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id} - {self.status}"

# =========================================================================
class MaterialRating(models.Model):
    """
    Dedicated rating for a specific PDF/Material.
    This feeds the 'Star Rating' shown on search results.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=255, db_index=True) # Link to user
    file = models.CharField(max_length=500, db_index=True) # Link to the specific PDF/Material
    
    # 1 to 5 Star Rating
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)]) 
    
    # Is this relevant to their query? (Helpful for tuning the AI)
    is_relevant = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'material_ratings'
        unique_together = ['user_id', 'file'] # One rating per user per file
        indexes = [
            models.Index(fields=['file']),
            models.Index(fields=['rating']),
        ]

    def __str__(self):
        return f"{self.file} - {self.rating} Stars"


class CitationCopy(models.Model):
    document = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='citation_copies')
    user_id = models.CharField(max_length=100, blank=True, null=True)
    session_id = models.CharField(max_length=100, blank=True, null=True)
    citation_style = models.CharField(max_length=50)
    copied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-copied_at']