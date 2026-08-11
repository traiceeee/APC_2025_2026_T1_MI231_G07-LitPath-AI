from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
from django.http import StreamingHttpResponse
from .rag_service import RAGService
from .serializers import CSMFeedbackSerializer
from .models import CSMFeedback, CitationCopy, Material, MaterialView, ResearchHistory, SystemSettings, UserRole, UserAccount
from .models_password_reset import PasswordResetToken
from .password_validation import validate_password_strength
import secrets
from django.db.models import Count, Avg, Q, Sum
from django.db.models import Max
from django.db.models.functions import TruncMonth, TruncDate
from django.db import connection, models
import dateutil.parser
import time
from django.utils import timezone
from datetime import datetime, date, timedelta
from calendar import month_name
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
import psycopg2
from psycopg2.extras import RealDictCursor
from .permissions import get_authenticated_user, require_staff_or_admin

User = get_user_model()

# Supabase configuration
SUPABASE_URL = settings.DATABASES['default']['HOST'] if hasattr(settings.DATABASES['default'], 'HOST') else None
SUPABASE_DB = settings.DATABASES['default']['NAME'] if hasattr(settings.DATABASES['default'], 'NAME') else None
SUPABASE_USER = settings.DATABASES['default']['USER'] if hasattr(settings.DATABASES['default'], 'USER') else None
SUPABASE_PASSWORD = settings.DATABASES['default']['PASSWORD'] if hasattr(settings.DATABASES['default'], 'PASSWORD') else None
SUPABASE_PORT = settings.DATABASES['default']['PORT'] if hasattr(settings.DATABASES['default'], 'PORT') else 5432


# Parses date strings from the frontend
def parse_date_range(from_date, to_date):
    """Convert 'YYYY-MM-DD' strings to timezone-aware datetimes, default to last 30 days."""
    if not from_date or not to_date:
        to_date_obj = timezone.now().date()
        from_date_obj = to_date_obj - timedelta(days=30)
    else:
        try:
            from_date_obj = datetime.strptime(from_date, '%Y-%m-%d').date()
            to_date_obj = datetime.strptime(to_date, '%Y-%m-%d').date()
        except ValueError:
            # Fallback
            to_date_obj = timezone.now().date()
            from_date_obj = to_date_obj - timedelta(days=30)
    from_datetime = timezone.make_aware(datetime.combine(from_date_obj, datetime.min.time()))
    to_datetime = timezone.make_aware(datetime.combine(to_date_obj, datetime.max.time()))
    return from_datetime, to_datetime


CSM_FEEDBACK_FIELD_LABELS = {
    'status': 'Status',
    'admin_category': 'Category',
    'is_valid': 'Is this valid?',
    'validity_remarks': 'Validity remarks',
    'is_doable': 'Is it doable?',
    'feasibility_remarks': 'Feasibility remarks',
}


def _format_audit_value(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return timezone.localtime(value).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _get_editor_label(user):
    if not user:
        return None
    return user.full_name or user.username or user.email or str(user.id)


def insert_to_supabase_general_feedback(data):
    """
    Insert feedback data into Supabase general_feedback table.
    Returns True on success, False on failure.
    """
    try:
        resolved_client_type = data.get('client_type_other') if (data.get('client_type') == 'Others' and data.get('client_type_other')) else data.get('client_type')

        # Get Supabase connection settings from Django settings
        # Check if SUPABASE_URL env var is set for external Supabase
        import os
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_db = os.environ.get('SUPABASE_DB')
        supabase_user = os.environ.get('SUPABASE_USER')
        supabase_password = os.environ.get('SUPABASE_PASSWORD')
        supabase_port = os.environ.get('SUPABASE_PORT', '5432')
        
        # If not set via env, use local DB settings
        if not supabase_url:
            if hasattr(settings.DATABASES['default'], 'HOST'):
                supabase_url = settings.DATABASES['default']['HOST']
            else:
                return False
        if not supabase_db:
            supabase_db = settings.DATABASES['default']['NAME'] if hasattr(settings.DATABASES['default'], 'NAME') else None
        if not supabase_user:
            supabase_user = settings.DATABASES['default']['USER'] if hasattr(settings.DATABASES['default'], 'USER') else None
        if not supabase_password:
            supabase_password = settings.DATABASES['default']['PASSWORD'] if hasattr(settings.DATABASES['default'], 'PASSWORD') else None
        if not supabase_port:
            supabase_port = str(settings.DATABASES['default']['PORT']) if hasattr(settings.DATABASES['default'], 'PORT') else '5432'
        
        if not all([supabase_url, supabase_db, supabase_user, supabase_password]):
            print("Supabase configuration incomplete")
            return False
        
        conn = psycopg2.connect(
            host=supabase_url,
            database=supabase_db,
            user=supabase_user,
            password=supabase_password,
            port=supabase_port
        )
        
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO general_feedback (
                user_id, session_id, consent_given, client_type, 
                date, sex, age, region, category, litpath_rating,
                research_interests, missing_content, message_comment,
                school_level, school_name, company
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            data.get('user_id'),
            data.get('session_id'),
            data.get('consent_given'),
            resolved_client_type,
            data.get('date'),
            data.get('sex'),
            data.get('age'),
            data.get('region'),
            data.get('category'),
            data.get('litpath_rating'),
            data.get('research_interests'),
            data.get('missing_content'),
            data.get('message_comment'),
            data.get('school_level'),
            data.get('school_name'),
            data.get('company')
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error inserting to Supabase general_feedback: {e}")
        return False

# ============= Filters View =============
class FiltersView(APIView):
    """
    GET /api/filters/
    Returns available filter options (subjects and years)
    
    Response:
    {
        "subjects": ["Agriculture", "Computer Science", ...],
        "years": ["2023", "2022", "2021", ...]
    }
    """
    
    def get(self, request):
        try:
            rag = RAGService.ensure_initialized()
            # If background indexing is still running, return partial/empty
            if RAGService.is_indexing():
                return Response(
                    {"subjects": [], "years": [], "indexing": True,
                     "message": "System is indexing theses, filters will appear shortly."},
                    status=status.HTTP_200_OK
                )
            filters = rag.get_available_filters()
            
            return Response(filters, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ============= Health Check View =============
class HealthCheckView(APIView):
    """
    GET /api/health/
    Returns health status of the RAG system
    """
    
    def get(self, request):
        try:
            from django.conf import settings
            import os
            import glob
            
            theses_folder = settings.RAG_THESES_FOLDER
            txt_files = glob.glob(os.path.join(theses_folder, '*.txt'))
            pdf_files = glob.glob(os.path.join(theses_folder, '*.pdf'))
            
            # Get detailed stats if RAG is initialized
            # Note: health check does NOT trigger lazy init (must respond fast)
            if RAGService._initialized:
                rag = RAGService()
                detailed_status = rag.get_health_status()
                health_data = {
                    "status": "healthy",
                    "message": "Backend is running",
                    "total_documents": detailed_status["total_documents"],
                    "total_chunks": detailed_status["total_chunks"],
                    "txt_files": len(txt_files),
                    "pdf_files": len(pdf_files),
                    "rag_initialized": True,
                    "indexing_in_progress": RAGService.is_indexing()
                }
            else:
                health_data = {
                    "status": "healthy",
                    "message": "Backend is running, RAG will initialize on first search",
                    "total_documents": 0,
                    "total_chunks": 0,
                    "txt_files": len(txt_files),
                    "pdf_files": len(pdf_files),
                    "rag_initialized": False
                }
            
            return Response(health_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"status": "unhealthy", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ============= Search View =============
class SearchView(APIView):
    """
    POST /api/search/
    Search for relevant theses and generate AI overview
    """
    
    def post(self, request):
        import uuid
        import re
        request_id = str(uuid.uuid4())
        print(f"[RAG-DEBUG] SearchView.post called. Request ID: {request_id}")
        try:
            question = request.data.get("question", "").strip()
            filters = request.data.get("filters", {})
            conversation_history = request.data.get("conversation_history", [])
            overview_only = request.data.get("overview_only", False)
            exclude_files = request.data.get("exclude_files", [])
            continuation_context = request.data.get("continuation_context", {})

            if exclude_files and not isinstance(exclude_files, list):
                return Response(
                    {"error": "'exclude_files' must be a list"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not question:
                return Response(
                    {"error": "Missing question parameter"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Start timing the whole request
            start_time = time.time()
            
            # Extract filter parameters from explicit filters
            subjects = filters.get("subjects", [])
            year = filters.get("year")
            year_start = filters.get("year_start")
            year_end = filters.get("year_end")
            
            # Extract filters from natural language query if no explicit filters provided
            from .query_parser import extract_filters_from_query
            
            rag = RAGService.ensure_initialized()

            # If background indexing is in progress, return early with a message
            if RAGService.is_indexing():
                return Response({
                    "question": question,
                    "results": [],
                    "documents": [],
                    "overview": "The system is currently indexing theses. Please try again in a few minutes.",
                    "indexing": True,
                    "total_results": 0,
                }, status=status.HTTP_200_OK)

            system_settings = SystemSettings.get_solo()
            search_settings = system_settings.search_settings or {}
            result_limit = int(search_settings.get('result_limit', 10) or 10)
            rerank_top_k = int(search_settings.get('rerank_top_k', 15) or 15)
            distance_threshold = float(search_settings.get('distance_threshold', 1.2) or 1.2)

            available_filters = rag.get_available_filters()
            
            parsed = extract_filters_from_query(question, available_filters.get("subjects", []))
            
            if not subjects and parsed.get("subjects"):
                subjects = parsed["subjects"]
                print(f"[RAG] Extracted subjects from query: {subjects}")
            
            if not year and not year_start and not year_end:
                if parsed.get("year"):
                    year = parsed["year"]
                    print(f"[RAG] Extracted year from query: {year}")
                elif parsed.get("year_start") or parsed.get("year_end"):
                    year_start = parsed.get("year_start")
                    year_end = parsed.get("year_end")
                    print(f"[RAG] Extracted year range from query: {year_start} - {year_end}")
            
            if parsed.get("extracted_filters"):
                if parsed["extracted_filters"].get("year_phrases"):
                    print(f"[RAG] Year phrases detected: {parsed['extracted_filters']['year_phrases']}")
                if parsed["extracted_filters"].get("subject_phrases"):
                    print(f"[RAG] Subject phrases detected: {parsed['extracted_filters']['subject_phrases']}")
            
            if subjects and not isinstance(subjects, list):
                return Response(
                    {"error": "'subjects' must be a list"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Detect explicit "more results" intent and avoid pronoun/entity expansion,
            # which can inject unrelated terms (e.g., from prior answers) and skew retrieval.
            is_more_results_query = bool(re.search(
                r"\b(more|additional|another|next)\b.*\b(results?|documents?|theses?|thesis|titles?|papers?|publications?)\b",
                question,
                re.IGNORECASE,
            ))

            # Resolve pronouns in query using conversation history when appropriate.
            from .conversation_utils import conversation_manager
            if is_more_results_query:
                enhanced_question = question
            else:
                enhanced_question = conversation_manager.resolve_pronouns(question, conversation_history)
            
            # Search for relevant chunks with filters
            search_start = time.time()
            top_chunks, documents, distance_threshold = rag.search(
                enhanced_question,
                subjects=None,  # Subject filter disabled - causes false-negative 0-doc results
                year=year,
                year_start=year_start,
                year_end=year_end,
                exclude_files=exclude_files,
                conversation_history=conversation_history,
                request_id=request_id
            )
            search_time = time.time() - search_start
            print(f"[RAG] Search took {search_time:.2f}s")
            
            # Early return if overview not requested
            if not overview_only:
                filters_applied = {}
                if subjects:
                    filters_applied["subjects"] = subjects
                    if parsed.get("subjects") and subjects == parsed["subjects"]:
                        filters_applied["subjects_auto_extracted"] = True
                if year:
                    filters_applied["year"] = year
                    if parsed.get("year") and year == parsed["year"]:
                        filters_applied["year_auto_extracted"] = True
                if year_start or year_end:
                    filters_applied["year_range"] = [year_start, year_end]
                    if parsed.get("year_start") or parsed.get("year_end"):
                        filters_applied["year_range_auto_extracted"] = True
                
                no_results = not any(c["score"] < distance_threshold for c in top_chunks)
                suggestions = []
                if no_results:
                    documents = []
                    if subjects:
                        suggestions.append(f"Try removing the subject filter '{subjects[0]}' to broaden your search")
                    if year:
                        suggestions.append(f"Try removing the year filter ({year}) to include more documents")
                    if year_start or year_end:
                        suggestions.append("Try expanding or removing the date range filter")
                    if not subjects and not year and not year_start:
                        suggestions.append("Try using different keywords or simpler terms")
                        suggestions.append("Try breaking your question into smaller, specific queries")
                    if len(question.split()) > 10:
                        suggestions.append("Try shortening your query to key terms only")
                    suggestions.append("Try searching for broader topics related to your question")
                    top_n=result_limit,
                    distance_threshold=distance_threshold,
                    rerank_top_k=rerank_top_k,
                
                # === Record response time ===
                # CHANGED: Use the pure vector search retrieval time!
                response_time_ms = int(search_time * 1000)
                session_id = request.data.get('session_id')
                if session_id:
                    try:
                        rh = ResearchHistory.objects.filter(session_id=session_id).order_by('-created_at').first()
                        if rh:
                            rh.response_time_ms = response_time_ms
                            rh.sources_count = len(documents) if documents else 0
                            rh.save(update_fields=['response_time_ms', 'sources_count'])
                        else:
                            ResearchHistory.objects.create(
                                session_id=session_id,
                                query=question,
                                response_time_ms=response_time_ms,
                                sources_count=len(documents) if documents else 0,
                            )
                    except Exception as e:
                        print(f"Error recording search time: {e}")
                
                # Serialize search context so streaming endpoint can reuse it (avoids duplicate search)
                _search_context = {
                    "top_chunks": [
                        {"chunk": c["chunk"][:2000], "meta": c.get("meta", {}), "score": c["score"]}
                        for c in top_chunks
                    ],
                    "distance_threshold": distance_threshold,
                }
                
                return Response({
                    "documents": documents,
                    "related_questions": [],
                    "filters_applied": filters_applied if filters_applied else None,
                    "suggestions": suggestions if suggestions else None,
                    "overview": None,
                    "overview_ready": False,
                    "_search_context": _search_context,
                }, status=status.HTTP_200_OK)
            
            # Generate overview (overview_only=True)
            generate_start = time.time()
            overview = rag.generate_overview(
                top_chunks,
                question,
                distance_threshold,
                conversation_history,
                continuation_context=continuation_context,
            )
            generate_time = time.time() - generate_start
            print(f"[RAG] AI generation took {generate_time:.2f}s")
            
            total_time = time.time() - start_time
            print(f"[RAG] Total time: {total_time:.2f}s")
            
            # Accuracy metrics
            search_metrics = rag.calculate_search_metrics(top_chunks, distance_threshold)
            citation_metrics = rag.verify_citations(overview, top_chunks)
            
            from .accuracy_metrics import accuracy_metrics
            source_texts = [c["chunk"] for c in top_chunks[:5]]
            hallucination_metrics = accuracy_metrics.detect_hallucinations_keyword(overview, source_texts)
            
            print(f"[RAG] Search Metrics: {search_metrics['documents_returned']} docs, avg_distance={search_metrics['avg_distance']}")
            print(f"[RAG] Citation Verification: {citation_metrics['verified_citations']}/{citation_metrics['total_citations']} ({citation_metrics['verification_rate']}%)")
            print(f"[RAG] Factual Accuracy: {hallucination_metrics['factual_accuracy']}%")
            
            rag_evaluation = None
            include_rag_eval = request.data.get("include_rag_evaluation", False)
            if include_rag_eval:
                try:
                    from .rag_evaluator import quick_evaluate
                    rag_evaluation = quick_evaluate(
                        query=question,
                        response=overview,
                        retrieved_docs=source_texts
                    )
                    print(f"[RAG] LangSmith-style Evaluation: relevance={rag_evaluation.get('relevance', {}).get('score')}, groundedness={rag_evaluation.get('groundedness', {}).get('score') if rag_evaluation.get('groundedness') else 'N/A'}")
                except Exception as eval_err:
                    print(f"[RAG] RAG evaluation skipped: {eval_err}")
            
            no_results = not any(c["score"] < distance_threshold for c in top_chunks)
            if no_results:
                import re
                overview = re.sub(r"\[\d+\]", "", overview)

            response_data = {
                "overview": overview,
                "overview_ready": True,
                "accuracy_metrics": {
                    "search": search_metrics,
                    "citation_verification": citation_metrics,
                    "hallucination_detection": {
                        "method": hallucination_metrics.get("method"),
                        "factual_accuracy": hallucination_metrics.get("factual_accuracy"),
                        "hallucination_rate": hallucination_metrics.get("hallucination_rate"),
                        "sentences_analyzed": hallucination_metrics.get("total_sentences")
                    }
                }
            }
            
            if rag_evaluation:
                response_data["rag_evaluation"] = rag_evaluation
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============= Streaming Search View (SSE) =============
class StreamingSearchView(APIView):
    """
    POST /api/search/stream/
    Stream AI overview generation via Server-Sent Events.
    Accepts optional _search_context from the initial SearchView response
    to avoid re-running the full search pipeline.
    """
    
    def post(self, request):
        import uuid
        import json as json_mod
        import re
        request_id = str(uuid.uuid4())
        print(f"[RAG-DEBUG] StreamingSearchView.post called. Request ID: {request_id}")
        
        try:
            question = request.data.get("question", "").strip()
            conversation_history = request.data.get("conversation_history", [])
            search_context = request.data.get("_search_context")
            exclude_files = request.data.get("exclude_files", [])
            continuation_context = request.data.get("continuation_context", {})
            
            if not question:
                return Response(
                    {"error": "Missing question parameter"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            rag = RAGService.ensure_initialized()

            system_settings = SystemSettings.get_solo()
            search_settings = system_settings.search_settings or {}
            result_limit = int(search_settings.get('result_limit', 10) or 10)
            rerank_top_k = int(search_settings.get('rerank_top_k', 15) or 15)
            distance_threshold = float(search_settings.get('distance_threshold', 1.2) or 1.2)

            if RAGService.is_indexing():
                return Response({
                    "overview": "The system is currently indexing theses. Please try again in a few minutes.",
                    "indexing": True,
                }, status=status.HTTP_200_OK)

            # If search context was passed from the initial search, reuse it (no duplicate search)
            if search_context and isinstance(search_context, dict):
                top_chunks = search_context.get("top_chunks", [])
                distance_threshold = search_context.get("distance_threshold", 1.2)
                print(f"[RAG-DEBUG] Request ID {request_id}: Reusing search context ({len(top_chunks)} chunks, threshold={distance_threshold})")
            else:
                # Fallback: do full search if no context provided (e.g. direct API call)
                print(f"[RAG-DEBUG] Request ID {request_id}: No search context provided, running full search")
                filters = request.data.get("filters", {})
                subjects = filters.get("subjects", [])
                year = filters.get("year")
                year_start = filters.get("year_start")
                year_end = filters.get("year_end")
                
                from .query_parser import extract_filters_from_query
                available_filters = rag.get_available_filters()
                parsed = extract_filters_from_query(question, available_filters.get("subjects", []))
                
                if not subjects and parsed.get("subjects"):
                    subjects = parsed["subjects"]
                if not year and not year_start and not year_end:
                    if parsed.get("year"):
                        year = parsed["year"]
                    elif parsed.get("year_start") or parsed.get("year_end"):
                        year_start = parsed.get("year_start")
                        year_end = parsed.get("year_end")
                
                is_more_results_query = bool(re.search(
                    r"\b(more|additional|another|next)\b.*\b(results?|documents?|theses?|thesis|titles?|papers?|publications?)\b",
                    question,
                    re.IGNORECASE,
                ))

                from .conversation_utils import conversation_manager
                if is_more_results_query:
                    enhanced_question = question
                else:
                    enhanced_question = conversation_manager.resolve_pronouns(question, conversation_history)
                
                top_chunks, documents, distance_threshold = rag.search(
                    enhanced_question,
                    subjects=None,
                    year=year,
                    year_start=year_start,
                    year_end=year_end,
                    top_n=result_limit,
                    distance_threshold=distance_threshold,
                    rerank_top_k=rerank_top_k,
                    exclude_files=exclude_files,
                    conversation_history=conversation_history,
                    request_id=request_id
                )
            
            def event_stream():
                """Generator that yields SSE events from Gemini streaming."""
                try:
                    for event_type, data in rag.generate_overview_stream(
                        top_chunks,
                        question,
                        distance_threshold,
                        conversation_history,
                        continuation_context=continuation_context,
                    ):
                        payload = json_mod.dumps({"type": event_type, "content": data})
                        yield f"data: {payload}\n\n"
                except Exception as e:
                    error_payload = json_mod.dumps({"type": "error", "content": str(e)})
                    yield f"data: {error_payload}\n\n"
            
            response = StreamingHttpResponse(
                event_stream(),
                content_type='text/event-stream'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ============= Bookmark Views =============
from rest_framework.decorators import api_view
from .models import Bookmark, ResearchHistory, Feedback, Material, MaterialView
from .serializers import BookmarkSerializer, ResearchHistorySerializer, FeedbackSerializer
@api_view(['GET', 'POST'])
def bookmarks_view(request):
    """
    GET: List all bookmarks for a user
    POST: Create a new bookmark
    """
    user_id = request.query_params.get('user_id') or request.data.get('user_id')
    
    if not user_id:
        return Response(
            {"error": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if request.method == 'GET':
        bookmarks = Bookmark.objects.filter(user_id=user_id)
        serializer = BookmarkSerializer(bookmarks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = BookmarkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def bookmark_delete_view(request, bookmark_id):
    """Delete a specific bookmark"""
    try:
        bookmark = Bookmark.objects.get(id=bookmark_id)
        bookmark.delete()
        return Response(
            {"message": "Bookmark deleted successfully"},
            status=status.HTTP_200_OK
        )
    except Bookmark.DoesNotExist:
        return Response(
            {"error": "Bookmark not found"},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['DELETE'])
def bookmark_delete_by_file_view(request):
    """Delete bookmark by file path"""
    user_id = request.query_params.get('user_id')
    file = request.query_params.get('file')
    
    if not user_id or not file:
        return Response(
            {"error": "user_id and file are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    deleted_count, _ = Bookmark.objects.filter(user_id=user_id, file=file).delete()
    
    return Response(
        {"message": f"{deleted_count} bookmark(s) deleted"},
        status=status.HTTP_200_OK
    )

# ============= Research History Views =============
@api_view(['GET', 'POST'])
def research_history_view(request):
    """
    GET: List all research history for a user
    POST: Create a new research history session
    """
    user_id = request.query_params.get('user_id') or request.data.get('user_id')
    
    if not user_id:
        return Response(
            {"error": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if request.method == 'GET':
        history = ResearchHistory.objects.filter(user_id=user_id).order_by('-created_at')
        serializer = ResearchHistorySerializer(history, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        session_id = request.data.get('session_id')
        # Upsert: update existing session or create new one
        if session_id:
            obj, created = ResearchHistory.objects.update_or_create(
                session_id=session_id,
                defaults={
                    'user_id': request.data.get('user_id', ''),
                    'query': request.data.get('query', ''),
                    'all_queries': request.data.get('all_queries'),
                    'conversation_data': request.data.get('conversation_data'),
                    'sources_count': request.data.get('sources_count'),
                    'conversation_length': request.data.get('conversation_length'),
                }
            )
            serializer = ResearchHistorySerializer(obj)
            status_code = status.HTTP_200_OK if not created else status.HTTP_201_CREATED
            return Response(serializer.data, status=status_code)
        else:
            serializer = ResearchHistorySerializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def research_history_delete_view(request, session_id):
    """Delete a specific research history session"""
    try:
        history = ResearchHistory.objects.get(session_id=session_id)
        history.delete()
        return Response(
            {"message": "Research history deleted successfully"},
            status=status.HTTP_200_OK
        )
    except ResearchHistory.DoesNotExist:
        return Response(
            {"error": "Research history not found"},
            status=status.HTTP_404_NOT_FOUND
        )

# ============= Feedback Views =============

@api_view(['GET', 'POST'])
def feedback_view(request):
    """
    GET: List all feedback with material titles (for analytics)
    POST: Submit new feedback
    """
    if request.method == 'GET':
        user, error_response = get_authenticated_user(request)
        if error_response:
            return error_response
        if not user.is_staff_or_admin():
            return Response(
                {'success': False, 'message': 'You do not have permission to access this resource.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Optional: filter by user_id for user-specific feedback
        user_id = request.query_params.get('user_id')
        if user_id:
            feedback = Feedback.objects.filter(user_id=user_id)
        else:
            # For admin analytics - get all feedback
            feedback = Feedback.objects.all()

        # Collect unique document files from the feedback queryset
        files = feedback.values_list('document_file', flat=True).distinct()
        # Fetch corresponding materials and build lookup dict (file -> title)
        materials = Material.objects.filter(file__in=files).values('file', 'title')
        title_lookup = {m['file']: m['title'] for m in materials}

        # Pass lookup dict to serializer context
        serializer = FeedbackSerializer(
            feedback, many=True, context={'material_titles': title_lookup}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        serializer = FeedbackSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Manage feedback for system admin
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@require_staff_or_admin
def feedback_detail(request, pk):
    """
    GET: Retrieve single feedback
    PATCH: Update status and triage info
    DELETE: Remove feedback
    """
    try:
        # We use 'pk' (primary key) to find the specific feedback
        feedback = Feedback.objects.get(pk=pk)
    except Feedback.DoesNotExist:
        return Response({'error': 'Feedback not found'}, status=status.HTTP_404_NOT_FOUND)

    # GET: View details
    if request.method == 'GET':
        serializer = FeedbackSerializer(feedback)
        return Response(serializer.data)

    # PATCH/PUT: Update (This is what your frontend needs)
    elif request.method in ['PUT', 'PATCH']:
        # Partial=True is critical for updating just the status
        serializer = FeedbackSerializer(feedback, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        # Print errors to your terminal for easier debugging
        print("Serializer Errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE: Remove it
    elif request.method == 'DELETE':
        feedback.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    

# ============= CSM Feedback Views =============
@api_view(['GET', 'POST'])
def csm_feedback_view(request):
    """
    GET: List all CSM feedback (for admin analytics) - staff/admin only
    POST: Submit new CSM feedback - open to all users
    """
    if request.method == 'GET':
        # Check if user is staff or admin for GET requests
        user, error_response = get_authenticated_user(request)
        if error_response:
            return error_response
        
        if user.role not in [UserRole.STAFF, UserRole.ADMIN]:
            return Response(
                {'error': 'Unauthorized - admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Optional: filter by user_id for user-specific feedback
        user_id = request.query_params.get('user_id')
        if user_id:
            csm_feedback = CSMFeedback.objects.filter(user_id=user_id)
        else:
            # For admin analytics - get all CSM feedback
            csm_feedback = CSMFeedback.objects.all()
        
        serializer = CSMFeedbackSerializer(csm_feedback, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = CSMFeedbackSerializer(data=request.data)
        if serializer.is_valid():
            # Save to Django database first
            serializer.save()
            
            # Also insert into Supabase general_feedback table
            insert_to_supabase_general_feedback(request.data)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE', 'PATCH']) # Added PATCH here
@require_staff_or_admin
def csm_feedback_detail(request, pk):
    """
    GET: Retrieve single CSM feedback
    PATCH: Update Admin Triage fields (Status, Remarks, etc.)
    DELETE: Remove CSM feedback
    """
    try:
        csm_feedback = CSMFeedback.objects.get(pk=pk)
    except CSMFeedback.DoesNotExist:
        return Response({'error': 'CSM Feedback not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = CSMFeedbackSerializer(csm_feedback)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        # This allows AdminDashboard to update status/remarks
        serializer = CSMFeedbackSerializer(csm_feedback, data=request.data, partial=True)
        if serializer.is_valid():
            original_values = {
                field: getattr(csm_feedback, field)
                for field in serializer.validated_data.keys()
            }
            updated_feedback = serializer.save()

            changed_fields = []
            for field_name, new_value in serializer.validated_data.items():
                old_value = original_values.get(field_name)
                if old_value != new_value:
                    changed_fields.append({
                        'field': field_name,
                        'label': CSM_FEEDBACK_FIELD_LABELS.get(field_name, field_name.replace('_', ' ').title()),
                        'old_value': _format_audit_value(old_value),
                        'new_value': _format_audit_value(new_value),
                    })

            if changed_fields:
                acting_user = getattr(request, 'authenticated_user', None)
                timestamp = timezone.now()
                edit_history = list(updated_feedback.edit_history or [])
                edit_history.append({
                    'edited_at': timestamp.isoformat(),
                    'edited_by_id': getattr(acting_user, 'id', None),
                    'edited_by_name': _get_editor_label(acting_user),
                    'changes': changed_fields,
                })
                updated_feedback.last_edited_by = acting_user
                updated_feedback.last_edited_at = timestamp
                updated_feedback.edit_history = edit_history
                updated_feedback.save(update_fields=['last_edited_by', 'last_edited_at', 'edit_history'])

            return Response(CSMFeedbackSerializer(updated_feedback).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        csm_feedback.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    
# ============= Material Views (Most Browsed) =============
@api_view(['POST'])
def track_material_view(request):
    """
    POST /api/track-view/
    Track when a user views a material
    """
    try:
        user_id = request.data.get('user_id')
        file = request.data.get('file')
        session_id = request.data.get('session_id')
        
        if not file:
            return Response(
                {"error": "file is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create a new MaterialView record
        from .models import MaterialView, Material
        from django.utils import timezone
        
        # First, ensure the material exists in the materials table
        # (we'll create it if viewing for the first time)
        material, created = Material.objects.get_or_create(
            file=file,
            defaults={
                'title': request.data.get('title', 'Unknown'),
                'author': request.data.get('author', 'Unknown'),
                'year': request.data.get('year'),
                'abstract': request.data.get('abstract', ''),
                'degree': request.data.get('degree', 'Thesis'),
                'subjects': request.data.get('subjects', []),
                'school': request.data.get('school', 'Unknown')
            }
        )
        
        # Track the view
        MaterialView.objects.create(
            file=file,
            user_id=user_id,
            session_id=session_id,
            viewed_at=timezone.now()
        )
        
        return Response(
            {"success": True, "message": "View tracked successfully"},
            status=status.HTTP_201_CREATED
        )
        
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_most_browsed(request):
    try:
        limit = int(request.GET.get('limit', 10))
        from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    m.id,
                    m.file,
                    m.title,
                    m.author,
                    m.year,
                    m.abstract,
                    m.degree,
                    m.subjects,
                    m.school,
                    COUNT(DISTINCT mv.id) as view_count,
                    COALESCE(AVG(f.rating), 0) as avg_rating,
                    COUNT(DISTINCT f.id) as rating_count
                FROM materials m
                LEFT JOIN material_views mv ON m.file = mv.file AND mv.viewed_at BETWEEN %s AND %s
                LEFT JOIN feedback f ON m.file = f.document_file
                GROUP BY m.id, m.file, m.title, m.author, m.year, m.abstract, m.degree, m.subjects, m.school
                HAVING COUNT(DISTINCT mv.id) > 0
                ORDER BY view_count DESC, avg_rating DESC
                LIMIT %s
            """, [from_date, to_date, limit])
            
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Enrich with actual metadata from RAG if title/author are "Unknown"
        from .rag_service import RAGService
        
        # Ensure RAG is initialized for metadata enrichment
        try:
            RAGService.ensure_initialized()
        except Exception as e:
            print(f"[RAG] Could not initialize RAG for metadata enrichment: {e}")
        
        materials_data = []
        for row in results:
            title = row['title']
            author = row['author']
            year = row['year']
            abstract = row['abstract']
            degree = row['degree']
            school = row['school']
            
            # If metadata is missing, try to get it from the RAG system
            if (not title or title == 'Unknown') or (not author or author == 'Unknown') or (not year or year == 'Unknown') or (not school or school in ('Unknown Institution', 'Unknown', '')):
                try:
                    if RAGService._initialized and not RAGService.is_indexing():
                        rag = RAGService()
                        # Search for the document in the RAG system by file name
                        doc_metadata = rag.get_document_metadata(row['file'])
                        if doc_metadata:
                            if not title or title == 'Unknown':
                                title = doc_metadata.get('title', title)
                            if not author or author == 'Unknown':
                                author = doc_metadata.get('author', author)
                            if not year or year == 'Unknown':
                                year = doc_metadata.get('year', year)
                            if not abstract:
                                abstract = doc_metadata.get('abstract', abstract)
                            if not degree or degree == 'Thesis':
                                degree = doc_metadata.get('degree', degree)
                            if not school or school in ('Unknown Institution', 'Unknown', ''):
                                school = doc_metadata.get('school', school)
                            # Persist the enriched metadata back to the DB
                            try:
                                Material.objects.filter(file=row['file']).update(
                                    title=title, author=author, year=year,
                                    abstract=abstract or '', degree=degree or '',
                                    school=school or ''
                                )
                            except Exception:
                                pass
                except Exception as e:
                    print(f"Error fetching metadata for {row['file']}: {e}")
            
            materials_data.append({
                'file': row['file'],
                'title': title or 'Unknown Title',
                'author': author or 'Unknown Author',
                'year': year,
                'abstract': abstract or 'No abstract available.',
                'degree': degree or 'Thesis',
                'subjects': row['subjects'] if isinstance(row['subjects'], list) else [],
                'school': school or 'Unknown Institution',
                'view_count': int(row['view_count']),
                'avg_rating': round(float(row['avg_rating']), 2) if row['avg_rating'] else 0.0,
                'rating_count': int(row['rating_count'])
            })
        
        return Response(
            {
                'materials': materials_data,
                'count': len(materials_data)
            },
            status=status.HTTP_200_OK
            )
        
    except Exception as e:
        print(f"Error in get_most_browsed: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@require_staff_or_admin
def dashboard_top_theses(request):
    return get_most_browsed(getattr(request, '_request', request))


@api_view(['GET'])
def get_source_ratings(request):
    """
    GET /api/sources/ratings/
    Get average ratings by source (document/file) with statistics
    
    Query Parameters:
    - limit: Maximum number of sources to return (default: 20)
    - min_ratings: Minimum number of ratings required (default: 1)
    - order_by: 'avg_rating', 'rating_count', 'file' (default: 'avg_rating')
    """
    try:
        from django.db import connection
        from django.db.models import Avg, Count
        
        limit = int(request.GET.get('limit', 20))
        min_ratings = int(request.GET.get('min_ratings', 1))
        order_by = request.GET.get('order_by', 'avg_rating')
        
        # Map order_by to SQL column
        order_map = {
            'avg_rating': 'avg_rating DESC',
            'rating_count': 'rating_count DESC',
            'file': 'm.file ASC'
        }
        order_sql = order_map.get(order_by, 'avg_rating DESC')
        
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT 
                    m.file,
                    m.title,
                    m.author,
                    m.year,
                    COUNT(DISTINCT f.id) as rating_count,
                    COALESCE(AVG(f.rating), 0) as avg_rating,
                    COALESCE(MIN(f.rating), 0) as min_rating,
                    COALESCE(MAX(f.rating), 0) as max_rating,
                    COALESCE(STDDEV(f.rating), 0) as stddev_rating
                FROM materials m
                LEFT JOIN feedback f ON m.file = f.document_file
                GROUP BY m.file, m.title, m.author, m.year
                HAVING COUNT(DISTINCT f.id) >= %s
                ORDER BY {order_sql}
                LIMIT %s
            """, [min_ratings, limit])
            
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Enrich with metadata and format response
        from .rag_service import RAGService
        
        sources_data = []
        for row in results:
            title = row['title']
            author = row['author']
            
            # Try to get metadata from RAG if missing
            if not title or not author:
                try:
                    if RAGService._initialized:
                        rag = RAGService()
                        doc_metadata = rag.get_document_metadata(row['file'])
                        if doc_metadata:
                            title = doc_metadata.get('title', title)
                            author = doc_metadata.get('author', author)
                except Exception as e:
                    print(f"Error fetching metadata for {row['file']}: {e}")
            
            sources_data.append({
                'file': row['file'],
                'title': title or 'Unknown Title',
                'author': author or 'Unknown Author',
                'year': row['year'],
                'rating_count': int(row['rating_count']),
                'avg_rating': round(float(row['avg_rating']), 2) if row['avg_rating'] else 0.0,
                'min_rating': int(row['min_rating']) if row['min_rating'] else 0,
                'max_rating': int(row['max_rating']) if row['max_rating'] else 0,
                'stddev_rating': round(float(row['stddev_rating']), 2) if row['stddev_rating'] else 0.0
            })
        
        # Calculate overall statistics
        overall_stats = {}
        if results:
            overall_stats = {
                'total_sources': len(results),
                'total_ratings': sum(int(r['rating_count']) for r in results),
                'overall_avg_rating': round(sum(float(r['avg_rating']) for r in results) / len(results), 2),
                'highest_rated': max(sources_data, key=lambda x: x['avg_rating'])['title'] if sources_data else None,
                'most_rated': max(sources_data, key=lambda x: x['rating_count'])['title'] if sources_data else None
            }
        
        return Response(
            {
                'sources': sources_data,
                'statistics': overall_stats,
                'count': len(sources_data)
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        print(f"Error in get_source_ratings: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_material_rating_detail(request):
    """
    GET /api/materials/<file>/rating/
    Get detailed rating information for a specific material
    """
    try:
        from django.db import connection
        from django.utils import timezone
        from datetime import timedelta
        
        file_path = request.GET.get('file')
        if not file_path:
            return Response(
                {"error": "file parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get rating breakdown by rating value
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    rating,
                    COUNT(*) as count
                FROM feedback 
                WHERE document_file = %s AND rating IS NOT NULL
                GROUP BY rating
                ORDER BY rating DESC
            """, [file_path])
            
            rating_breakdown = [
                {'rating': row[0], 'count': row[1]}
                for row in cursor.fetchall()
            ]
        
        # Get recent feedback for this material
        recent_feedback = Feedback.objects.filter(
            document_file=file_path,
            rating__isnull=False
        ).order_by('-created_at')[:5].values(
            'rating', 'comment', 'created_at', 'user_id'
        )
        
        # Calculate summary
        summary = Feedback.objects.filter(
            document_file=file_path,
            rating__isnull=False
        ).aggregate(
            avg_rating=Avg('rating'),
            count=Count('id')
        )
        
        return Response({
            'file': file_path,
            'average_rating': round(float(summary['avg_rating'] or 0), 2),
            'rating_count': summary['count'],
            'rating_breakdown': rating_breakdown,
            'recent_feedback': list(recent_feedback)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error in get_material_rating_detail: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_sources_stats(request):
    """
    GET /api/sources/stats/
    Get view counts and average ratings for a list of source files.
    
    Query Parameters:
    - files: JSON array of file names
    """
    try:
        import json
        from django.db import connection
        
        files_param = request.GET.get('files')
        if not files_param:
            return Response(
                {"error": "files parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            files = json.loads(files_param)
            if not isinstance(files, list):
                files = [files]
        except json.JSONDecodeError:
            return Response(
                {"error": "Invalid files parameter. Must be a JSON array"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not files:
            return Response({"stats": {}}, status=status.HTTP_200_OK)
        
        # Default stats for all files
        stats = {f: {'view_count': 0, 'avg_rating': 0.0} for f in files}
        
        with connection.cursor() as cursor:
            # Get view counts
            placeholders = ','.join(['%s'] * len(files))
            cursor.execute(f"""
                SELECT 
                    mv.file,
                    COUNT(DISTINCT mv.id) as view_count
                FROM material_views mv
                WHERE mv.file IN ({placeholders})
                GROUP BY mv.file
            """, files)
            
            for row in cursor.fetchall():
                if row[0] in stats:
                    stats[row[0]]['view_count'] = int(row[1])
            
            # Get average ratings
            cursor.execute(f"""
                SELECT 
                    f.document_file,
                    COALESCE(AVG(f.rating), 0) as avg_rating
                FROM feedback f
                WHERE f.document_file IN ({placeholders}) AND f.rating IS NOT NULL
                GROUP BY f.document_file
            """, files)
            
            for row in cursor.fetchall():
                if row[0] in stats:
                    stats[row[0]]['avg_rating'] = round(float(row[1]), 2) if row[1] else 0.0
        
        return Response({"stats": stats}, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error in get_sources_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ============= Password Reset Views =============
from rest_framework.decorators import api_view

@api_view(['POST'])
def request_password_reset(request):
    """
    POST: Request password reset link
    Body: {"email": "..."}
    """
    from .models_password_reset import PasswordResetToken
    from rag_api.models import UserAccount
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({"success": False, "message": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
    user = UserAccount.objects.filter(email=email).first()
    if user:
        reset_token = secrets.token_urlsafe(32)
        expiry = timezone.now() + timezone.timedelta(minutes=15)
        try:
            PasswordResetToken.objects.create(
                user=user,
                token=PasswordResetToken.hash_token(reset_token),
                expiry=expiry,
                used=False,
            )
        except Exception as e:
            print(f"[DEBUG] Error creating PasswordResetToken: {e}")
        reset_link = f"http://localhost:5173/reset-password/{reset_token}"
        email_body = (
            "We received a password reset request for your account. "
            "To reset your password, just click the link below:\n\n"
            f"{reset_link}\n\n"
            "This link will expire after 15 minutes so be sure to reset your password soon.\n\n"
            "If you did not make this request, you can ignore this email."
        )
        # Send email with reset link
        try:
            send_mail(
                '[LitPath AI] Password reset',
                email_body,
                settings.DEFAULT_FROM_EMAIL,
                [email],
            )
        except Exception as e:
            print(f"[DEBUG] Error sending password reset email: {e}")
    # Always return success for security
    return Response({"success": True, "message": "If this email exists, a reset link will be sent."})

@api_view(['POST'])
def reset_password(request):
    """
    POST: Reset password using token
    Body: {"token": "...", "new_password": "..."}
    """
    from .models_password_reset import PasswordResetToken
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    if not token or not new_password:
        return Response({"error": "Token and new password are required."}, status=status.HTTP_400_BAD_REQUEST)
    prt = PasswordResetToken.find_unused_by_raw_token(token)
    if not prt:
        return Response({"error": "Invalid or used token."}, status=status.HTTP_400_BAD_REQUEST)
    if prt.expiry < timezone.now():
        return Response({"error": "Token expired."}, status=status.HTTP_400_BAD_REQUEST)

    is_valid_password, password_error = validate_password_strength(new_password)
    if not is_valid_password:
        return Response({"error": password_error}, status=status.HTTP_400_BAD_REQUEST)

    user = prt.user
    user.set_password(new_password)
    user.save()
    prt.used = True
    prt.save(update_fields=['used'])
    return Response({"success": True, "message": "Password reset successful."}, status=status.HTTP_200_OK)


# ============= RAG Evaluation API =============

class RAGEvaluationView(APIView):
    """
    POST /api/evaluate/
    Evaluate a RAG response using LangSmith-style methodology.
    
    This provides detailed evaluation of:
    - Relevance: Does the response address the question?
    - Groundedness: Is the response based on retrieved documents?
    - Retrieval Relevance: Are the retrieved documents relevant?
    - Correctness: Is the response factually correct? (requires reference answer)
    
    Reference: https://docs.langchain.com/langsmith/evaluate-rag-tutorial
    """
    
    def post(self, request):
        try:
            query = request.data.get("query", "").strip()
            response_text = request.data.get("response", "").strip()
            retrieved_docs = request.data.get("retrieved_docs", [])
            reference_answer = request.data.get("reference_answer")  # Optional
            evaluation_type = request.data.get("type", "quick")  # "quick" or "full"
            
            if not query or not response_text:
                return Response(
                    {"error": "Missing 'query' or 'response' parameter"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from .rag_evaluator import get_rag_evaluator, quick_evaluate
            
            if evaluation_type == "quick":
                # Quick evaluation - just relevance and groundedness
                result = quick_evaluate(
                    query=query,
                    response=response_text,
                    retrieved_docs=retrieved_docs
                )
                return Response({
                    "success": True,
                    "evaluation_type": "quick",
                    "results": result
                }, status=status.HTTP_200_OK)
            else:
                # Full evaluation with all metrics
                evaluator = get_rag_evaluator()
                report = evaluator.evaluate(
                    query=query,
                    response=response_text,
                    retrieved_docs=retrieved_docs,
                    reference_answer=reference_answer,
                    skip_correctness=(reference_answer is None)
                )
                return Response({
                    "success": True,
                    "evaluation_type": "full",
                    "results": report.to_dict()
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ============= Endpoint 1 – KPI (Total Theses, Total Searches, Utilisation, Avg Response Time, Failed Queries) =============
@api_view(['GET'])
@require_staff_or_admin
def dashboard_kpi(request):
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    total_docs = Material.objects.count()
    unique_visitors = MaterialView.objects.filter(viewed_at__range=[from_date, to_date]).values('user_id', 'session_id').distinct().count()
    total_searches = ResearchHistory.objects.filter(created_at__range=[from_date, to_date]).count()
    accessed_docs = MaterialView.objects.filter(viewed_at__range=[from_date, to_date]).values('file').distinct().count()
    utilization = (accessed_docs / total_docs * 100) if total_docs else 0

    # Average response time (FIXED: Exclude 0s from old unrecorded data)
    avg_response_time = ResearchHistory.objects.filter(
        created_at__range=[from_date, to_date],
        response_time_ms__isnull=False,
        response_time_ms__gt=0  # <--- ADD THIS LINE TO IGNORE ZEROES
    ).aggregate(avg=Avg('response_time_ms'))['avg'] or 0

    return Response({
        'totalDocuments': total_docs,
        'uniqueVisitors': unique_visitors,
        'totalSearches': total_searches,
        'accessedDocuments': accessed_docs,
        'utilizationPercent': round(utilization, 1),
        'avgResponseTime': round(avg_response_time, 0)
    })

# Failed Queries Count
@api_view(['GET'])
@require_staff_or_admin
def dashboard_failed_queries_count(request):
    """
    GET /api/dashboard/failed-queries-count/
    Returns total number of failed queries (zero results) in the date range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    total_failed = ResearchHistory.objects.filter(
        created_at__range=[from_date, to_date],
        sources_count=0
    ).count()

    return Response({'total': total_failed})

# Failed Queries Details
@api_view(['GET'])
@require_staff_or_admin
def dashboard_failed_queries_details(request):
    """
    GET /api/dashboard/failed-queries-details/
    Returns top failed queries (zero results) with their counts in the date range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))
    limit = int(request.GET.get('limit', 10))

    failed_queries = ResearchHistory.objects.filter(
        created_at__range=[from_date, to_date],
        sources_count=0
    ).values('query').annotate(count=models.Count('query')).order_by('-count')[:limit]

    return Response({'failed_queries': list(failed_queries)})

# ============= Endpoint 2 – Trending Topics =============
@api_view(['GET'])
@require_staff_or_admin
def dashboard_trending_topics(request):
    """
    GET /api/dashboard/trending-topics/
    Returns subjects with highest growth in views between two periods.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))
    period_length = (to_date - from_date).days
    prev_from = from_date - timedelta(days=period_length)
    prev_to = from_date - timedelta(days=1)

    # Current period views per subject
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                unnest(m.subjects) as keyword,
                COUNT(DISTINCT mv.id) as views
            FROM materials m
            JOIN material_views mv ON m.file = mv.file
            WHERE mv.viewed_at BETWEEN %s AND %s
              AND m.subjects IS NOT NULL
              AND array_length(m.subjects, 1) > 0
            GROUP BY keyword
        """, [from_date, to_date])
        current_rows = cursor.fetchall()
        current_dict = {row[0]: row[1] for row in current_rows}

        # Previous period views per subject
        cursor.execute("""
            SELECT 
                unnest(m.subjects) as keyword,
                COUNT(DISTINCT mv.id) as views
            FROM materials m
            JOIN material_views mv ON m.file = mv.file
            WHERE mv.viewed_at BETWEEN %s AND %s
              AND m.subjects IS NOT NULL
              AND array_length(m.subjects, 1) > 0
            GROUP BY keyword
        """, [prev_from, prev_to])
        prev_rows = cursor.fetchall()
        prev_dict = {row[0]: row[1] for row in prev_rows}

    # Compute growth, filter subjects with at least 3 views in current period
    trending = []
    for subject, current_views in current_dict.items():
        if current_views < 3:
            continue
        prev_views = prev_dict.get(subject, 0)
        if prev_views == 0:
            growth = 100.0  # treat as 100% growth
        else:
            growth = ((current_views - prev_views) / prev_views) * 100
        trending.append({
            'subject': subject,
            'current_views': current_views,
            'prev_views': prev_views,
            'growth': round(growth, 1)
        })

    # Sort by growth descending, take top 7
    trending.sort(key=lambda x: x['growth'], reverse=True)
    return Response(trending[:7])

# ============= Endpoint 3 – Top 7 Most Viewed Theses =============

# ============= Endpoint 4 – Usage by User Category (from CSMFeedback) =============
ALL_CATEGORIES = [
    'Student',
    'DOST Employee',
    'Librarian/Library Staff',
    'Other Government Employee',
    'Teaching Personnel',
    'Administrative Personnel',
    'Researcher'
]

@api_view(['GET'])
@require_staff_or_admin
def dashboard_usage_by_category(request):
    """GET /api/dashboard/usage-by-category/ – breakdown from CSMFeedback (all categories)."""
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    actual = (
        CSMFeedback.objects
        .filter(created_at__range=[from_date, to_date], category__isnull=False)
        .exclude(category='')
        .values('category')
        .annotate(count=Count('id'))
    )
    count_dict = {item['category']: item['count'] for item in actual}

    total = sum(count_dict.values()) or 1

    data = []
    for cat in ALL_CATEGORIES:
        count = count_dict.get(cat, 0)
        data.append({
            'category': cat,
            'views': count,
            'percentage': round((count / total * 100), 1) if total else 0
        })
    return Response(data)

# ============= Endpoint 5 – Age Distribution =============

# All age groups from the CSMFeedback form
import re

# Mapping from normalized short age strings to full display strings
AGE_DISPLAY_MAP = {
    '10 and below': '10 years old and below',
    '11-15': '11 - 15 years old',
    '16-20': '16 - 20 years old',
    '21-25': '21 - 25 years old',
    '26-30': '26 - 30 years old',
    '31-35': '31 - 35 years old',
    '36-40': '36 - 40 years old',
    '41-45': '41 - 45 years old',
    '46-50': '46 - 50 years old',
    '51-55': '51 - 55 years old',
    '56-60': '56 - 60 years old',
    '61 and above': '61 years old and above'
}

# All possible display strings in order (for zero filling)
ALL_AGE_DISPLAYS = list(AGE_DISPLAY_MAP.values())

def normalize_age(age_str):
    """Convert various age formats to a standard short form (e.g., '21-25')."""
    if not age_str:
        return ''
    # Replace en dash with hyphen
    age_str = age_str.replace('–', '-')
    # Extract numbers and range
    match = re.search(r'(\d+)\s*[-–]\s*(\d+)', age_str)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.search(r'(\d+)\s+and\s+above', age_str, re.IGNORECASE)
    if match:
        return "61 and above"  # assuming only this special case
    match = re.search(r'(\d+)\s+and\s+below', age_str, re.IGNORECASE)
    if match:
        return "10 and below"
    return age_str

@api_view(['GET'])
@require_staff_or_admin
def dashboard_age_distribution(request):
    """
    GET /api/dashboard/age-distribution/
    Returns age groups and counts (including zero) from CSMFeedback within the date range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    # Get actual counts from database
    actual_counts = (
        CSMFeedback.objects
        .filter(created_at__range=[from_date, to_date], age__isnull=False)
        .exclude(age='')
        .values('age')
        .annotate(count=Count('id'))
    )

    # Build a dict of normalized short age -> count
    count_dict = {}
    for item in actual_counts:
        raw_age = item['age']
        norm = normalize_age(raw_age)
        # Map to display string if possible
        display = AGE_DISPLAY_MAP.get(norm, norm)  # fallback to raw if not found
        count_dict[display] = count_dict.get(display, 0) + item['count']

    total = sum(count_dict.values()) or 1

    # Build result for all age groups
    data = []
    for display in ALL_AGE_DISPLAYS:
        count = count_dict.get(display, 0)
        data.append({
            'age': display,
            'count': count,
            'percentage': round((count / total * 100), 1) if total else 0
        })
    return Response(data)

@api_view(['GET'])
@require_staff_or_admin
def dashboard_gender_distribution(request):
    """
    GET /api/dashboard/gender-distribution/
    Returns gender distribution and counts from CSMFeedback and UserAccount within the date range.
    Combines data from both CSM feedback form submissions and user account registrations.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    # Build a dict of gender -> count
    count_dict = {}

    # Get counts from CSMFeedback database
    csm_gender_counts = (
        CSMFeedback.objects
        .filter(created_at__range=[from_date, to_date], sex__isnull=False)
        .exclude(sex='')
        .values('sex')
        .annotate(count=Count('id'))
    )

    for item in csm_gender_counts:
        gender = item['sex']
        count_dict[gender] = count_dict.get(gender, 0) + item['count']

    # Get counts from UserAccount database (user registrations)
    user_gender_counts = (
        UserAccount.objects
        .filter(created_at__range=[from_date, to_date], sex__isnull=False)
        .exclude(sex='')
        .values('sex')
        .annotate(count=Count('id'))
    )

    for item in user_gender_counts:
        gender = item['sex']
        count_dict[gender] = count_dict.get(gender, 0) + item['count']

    total = sum(count_dict.values()) or 1

    # Define all possible gender options in order
    gender_options = ['Female', 'Male', 'Prefer not to say']

    # Build result for all gender options
    data = []
    for gender in gender_options:
        count = count_dict.get(gender, 0)
        data.append({
            'gender': gender,
            'count': count,
            'percentage': round((count / total * 100), 1) if total else 0
        })
    return Response(data)

# ============= Endpoint 6 – Activity Trends =============

# Monthly Trends (Views per Month)
@api_view(['GET'])
@require_staff_or_admin
def dashboard_monthly_trends(request):
    """
    GET /api/dashboard/monthly-trends/
    Returns view counts grouped by month within the given date range.
    Ensures all months in the range are represented, with 0 for missing months.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                EXTRACT(YEAR FROM viewed_at) as year,
                EXTRACT(MONTH FROM viewed_at) as month,
                COUNT(DISTINCT id) as views
            FROM material_views
            WHERE viewed_at BETWEEN %s AND %s
            GROUP BY EXTRACT(YEAR FROM viewed_at), EXTRACT(MONTH FROM viewed_at)
            ORDER BY year, month
        """, [from_date, to_date])
        rows = cursor.fetchall()

    # Build a dict of (year, month) -> views
    views_dict = {}
    for row in rows:
        year = int(row[0])
        month = int(row[1])
        views_dict[(year, month)] = row[2]

    # Generate all months from from_date to to_date
    start_month = from_date.replace(day=1)
    end_month = to_date.replace(day=1)
    current = start_month
    months = []
    while current <= end_month:
        year = current.year
        month = current.month
        views = views_dict.get((year, month), 0)
        month_full = month_name[month]   # 👈 full month name
        months.append({
            'month': month_full,
            'year': year,
            'views': views
        })
        # Move to next month
        if month == 12:
            current = current.replace(year=year+1, month=1)
        else:
            current = current.replace(month=month+1)

    return Response(months)

# Weekly Trends (Views per Week)
@api_view(['GET'])
@require_staff_or_admin
def dashboard_weekly_trends(request):
    """
    GET /api/dashboard/weekly-trends/?from=YYYY-MM-DD&to=YYYY-MM-DD
    Returns view counts grouped by week (Sunday to Saturday).
    All weeks in the range are included, with 0 for missing weeks.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    # FIX: Fetch daily counts instead of using PostgreSQL's date_trunc('week') 
    # to avoid the Monday-start vs Sunday-start mismatch.
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                viewed_at::date as day,
                COUNT(DISTINCT id) as views
            FROM material_views
            WHERE viewed_at BETWEEN %s AND %s
            GROUP BY day
        """, [from_date, to_date])
        rows = cursor.fetchall()

    # Dictionary of {datetime.date: views}
    daily_counts = {row[0]: row[1] for row in rows}

    # Generate all weeks in the range (Sunday to Saturday)
    current = from_date.date()
    if current.weekday() != 6:  # Not Sunday? Adjust back to the previous Sunday
        current = current - timedelta(days=(current.weekday() + 1) % 7)
        
    end_date = to_date.date()
    results = []
    
    while current <= end_date:
        week_end = current + timedelta(days=6)
        week_str = f"{current.strftime('%b %d')} - {week_end.strftime('%b %d')}"
        
        # Sum the views for the 7 days of THIS specific week
        week_views = 0
        for i in range(7):
            day_to_check = current + timedelta(days=i)
            week_views += daily_counts.get(day_to_check, 0)
            
        results.append({
            'week_start': current.isoformat(),
            'week_end': week_end.isoformat(),
            'label': week_str,
            'views': week_views
        })
        current += timedelta(days=7)
        
    return Response(results)

# Daily Trends (Views per Day)
@api_view(['GET'])
@require_staff_or_admin
def dashboard_daily_trends(request):
    """
    GET /api/dashboard/daily-trends/?from=YYYY-MM-DD&to=YYYY-MM-DD
    Returns view counts per day, including all days in the range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                viewed_at::date as day,
                COUNT(DISTINCT id) as views
            FROM material_views
            WHERE viewed_at BETWEEN %s AND %s
            GROUP BY day
            ORDER BY day
        """, [from_date, to_date])
        rows = cursor.fetchall()

    counts = {row[0]: row[1] for row in rows}

    # Generate all days
    current = from_date.date()
    results = []
    while current <= to_date.date():
        views = counts.get(current, 0)
        results.append({
            'day': current.isoformat(),
            'label': current.strftime('%b %d, %Y'),
            'views': views
        })
        current += timedelta(days=1)
    return Response(results)

# ============= Endpoint 7 – Citation Activity =============

# Track Citation Copy
@api_view(['POST'])
def track_citation_copy(request):
    try:
        file = request.data.get('file')
        citation_style = request.data.get('citation_style')
        user_id = request.data.get('user_id')
        session_id = request.data.get('session_id')

        if not file or not citation_style:
            return Response({"error": "file and citation_style required"}, status=400)

        material = Material.objects.filter(file=file).first()
        if not material:
            return Response({"error": "Material not found"}, status=404)

        CitationCopy.objects.create(
            document=material,
            user_id=user_id,
            session_id=session_id,
            citation_style=citation_style
        )
        return Response({"success": True}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# Dashboard Citation Stats
@api_view(['GET'])
@require_staff_or_admin
def dashboard_citation_stats(request):
    """
    GET /api/dashboard/citation-stats/
    Returns total citation copies and top cited theses within date range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    total_copies = CitationCopy.objects.filter(
        copied_at__range=[from_date, to_date]
    ).count()

    # Top 5 cited theses
    top_cited = (
        CitationCopy.objects
        .filter(copied_at__range=[from_date, to_date])
        .values('document__file', 'document__title', 'document__author', 'document__year')
        .annotate(copies=Count('id'))
        .order_by('-copies')[:5]
    )

    return Response({
        'total_copies': total_copies,
        'top_cited': list(top_cited)
    })


# Dashboard Citation Monthly
@api_view(['GET'])
@require_staff_or_admin
def dashboard_citation_monthly(request):
    """
    GET /api/dashboard/citation-monthly/
    Returns monthly citation copy counts within the date range.
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    # Aggregate by month
    monthly = (
        CitationCopy.objects
        .filter(copied_at__range=[from_date, to_date])
        .annotate(month=TruncMonth('copied_at'))
        .values('month')
        .annotate(copies=Count('id'))
        .order_by('month')
    )

    # Build dict of month -> copies
    copies_dict = {}
    for item in monthly:
        month_key = item['month'].strftime('%Y-%m')
        copies_dict[month_key] = item['copies']

    # Generate all months in range
    current = from_date.replace(day=1)
    result = []
    while current <= to_date:
        month_key = current.strftime('%Y-%m')
        copies = copies_dict.get(month_key, 0)
        result.append({
            'month': current.strftime('%B'),  # full month name
            'year': current.year,
            'copies': copies
        })
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year+1, month=1)
        else:
            current = current.replace(month=current.month+1)

    return Response(result)

# Dashboard Citation Weekly
@api_view(['GET'])
@require_staff_or_admin
def dashboard_citation_weekly(request):
    """Returns citation counts grouped by week (Sunday to Saturday)."""
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))
    
    # Get daily aggregates using Django ORM
    daily_aggs = CitationCopy.objects.filter(copied_at__range=[from_date, to_date])\
        .annotate(day=TruncDate('copied_at'))\
        .values('day')\
        .annotate(copies=Count('id'))
        
    daily_counts = {item['day']: item['copies'] for item in daily_aggs if item['day']}

    # Generate all weeks (Sunday to Saturday)
    current = from_date.date()
    if current.weekday() != 6:  # Adjust to previous Sunday
        current = current - timedelta(days=(current.weekday() + 1) % 7)
        
    end_date = to_date.date()
    results = []
    
    while current <= end_date:
        week_end = current + timedelta(days=6)
        week_str = f"{current.strftime('%b %d')} - {week_end.strftime('%b %d')}"
        week_copies = sum(daily_counts.get(current + timedelta(days=i), 0) for i in range(7))
        
        results.append({
            'week_start': current.isoformat(),
            'week_end': week_end.isoformat(),
            'label': week_str,
            'copies': week_copies
        })
        current += timedelta(days=7)
        
    return Response(results)

# Dashboard Citation Daily
@api_view(['GET'])
@require_staff_or_admin
def dashboard_citation_daily(request):
    """Returns citation counts grouped by individual days."""
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))
    
    daily_aggs = CitationCopy.objects.filter(copied_at__range=[from_date, to_date])\
        .annotate(day=TruncDate('copied_at'))\
        .values('day')\
        .annotate(copies=Count('id'))
        
    counts = {item['day']: item['copies'] for item in daily_aggs if item['day']}

    current = from_date.date()
    results = []
    while current <= to_date.date():
        results.append({
            'day': current.isoformat(),
            'label': current.strftime('%b %d, %Y'),
            'copies': counts.get(current, 0)
        })
        current += timedelta(days=1)
        
    return Response(results)

# ============= Endpoint – Top 7 Search Queries =============
@api_view(['GET'])
@require_staff_or_admin
def dashboard_top_search_queries(request):
    """
    GET /api/dashboard/top-search-queries/
    Returns the most frequent search queries within the date range (top 7).
    """
    from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))

    top_queries = (
        ResearchHistory.objects
        .filter(
            created_at__range=[from_date, to_date],
            query__isnull=False
        )
        .exclude(query='')
        .values('query')
        .annotate(count=Count('id'))
        .order_by('-count')[:7]
    )

    return Response([
        {'query': item['query'], 'count': item['count']}
        for item in top_queries
    ])


# ============= Material Ratings – Least Viewed Theses (Feature 13.0) =============
@api_view(['GET'])
@require_staff_or_admin
def dashboard_least_browsed(request):
    """
    GET /api/dashboard/least-browsed/
    Returns materials with the lowest view counts within the date range.
    Includes upload date and dormancy classification:
    - Dormant: Never accessed OR not accessed for 30+ days AND uploaded 30+ days ago
    - Recently Uploaded: Uploaded within the last 30 days
    """
    try:
        from django.utils import timezone
        from datetime import timedelta
        
        limit = int(request.GET.get('limit', 8))
        from_date, to_date = parse_date_range(request.GET.get('from'), request.GET.get('to'))
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        with connection.cursor() as cursor:
            # Include created_at and calculate dormancy flags
            cursor.execute("""
                SELECT 
                    m.id,
                    m.file,
                    m.title,
                    m.year,
                    m.created_at,
                    MAX(mv.viewed_at) as last_accessed,
                    COUNT(mv.id) as view_count,
                    -- Dormant: (never accessed AND uploaded 30+ days ago) OR (last accessed 30+ days ago AND uploaded 30+ days ago)
                    ((MAX(mv.viewed_at) IS NULL AND m.created_at < %s) OR 
                     (MAX(mv.viewed_at) < %s AND m.created_at < %s)) as is_dormant,
                    -- Recently uploaded: uploaded within 30 days
                    (m.created_at >= %s) as is_recently_uploaded
                FROM materials m
                LEFT JOIN material_views mv 
                    ON m.file = mv.file 
                    AND mv.viewed_at BETWEEN %s AND %s
                GROUP BY m.id, m.file, m.title, m.year, m.created_at
                ORDER BY view_count ASC, last_accessed ASC
                LIMIT %s
            """, [thirty_days_ago, thirty_days_ago, thirty_days_ago, thirty_days_ago, from_date, to_date, limit])
            
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]

        return Response(results, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error in dashboard_least_browsed: {str(e)}")
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ============= Material Ratings – Dormant Materials Count (Feature 13.0) =============
@api_view(['GET'])
@require_staff_or_admin
def dashboard_dormant_count(request):
    """
    GET /api/dashboard/dormant-count/
    Returns count of dormant materials using 30-day inactivity rule.
    Dormant = never accessed OR not accessed for 30+ days AND uploaded 30+ days ago.
    """
    try:
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(DISTINCT m.id)
                FROM materials m
                LEFT JOIN (
                    SELECT file, MAX(viewed_at) as last_viewed
                    FROM material_views
                    GROUP BY file
                ) mv_max ON m.file = mv_max.file
                WHERE 
                    -- Never accessed AND uploaded 30+ days ago
                    (mv_max.last_viewed IS NULL AND m.created_at < %s)
                    OR
                    -- Not accessed in 30+ days AND uploaded 30+ days ago
                    (mv_max.last_viewed < %s AND m.created_at < %s)
            """, [thirty_days_ago, thirty_days_ago, thirty_days_ago])
            count = cursor.fetchone()[0]
        
        return Response({'count': count})
    except Exception as e:
        print(f"Error in dashboard_dormant_count: {str(e)}")
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )