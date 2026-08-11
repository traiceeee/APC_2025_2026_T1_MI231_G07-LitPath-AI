
from rest_framework import serializers
from .models import UserAccount, Bookmark, ResearchHistory, Feedback, CSMFeedback

# Serializer for user profile update
class UserAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAccount
        fields = [
            'id', 'email', 'username', 'full_name', 'role',
            'school_level', 'school_name',
            'client_type', 'sex', 'age', 'region', 'category',
            'terms_accepted', 'terms_accepted_at', 'terms_version'
        ]
        read_only_fields = ['id', 'email', 'role']


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = [
            'id', 'user_id', 'title', 'author', 'year', 'abstract',
            'file', 'degree', 'subjects', 'school', 'bookmarked_at', 'updated_at'
        ]
        read_only_fields = ['id', 'bookmarked_at', 'updated_at']


class ResearchHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchHistory
        fields = [
            'id', 
            'session_id', 
            'user_id', 
            'query', 
            'all_queries',          # <--- Added this (stores follow-up query list)
            'conversation_data',    # <--- Added this (stores the actual Q&A)
            'conversation_length',  # <--- Added this (stores chat depth)
            'created_at', 
            'sources_count'         # <--- Critical for "Unanswered Questions" analytics
        ]
        read_only_fields = ['id', 'created_at']


class FeedbackSerializer(serializers.ModelSerializer):
    material_title = serializers.SerializerMethodField()

    class Meta:
        model = Feedback
        fields = '__all__'

    def get_material_title(self, obj):
        title_lookup = self.context.get('material_titles', {})
        return title_lookup.get(obj.document_file, None)


class CSMFeedbackSerializer(serializers.ModelSerializer):
    last_edited_by = serializers.PrimaryKeyRelatedField(read_only=True)
    last_edited_by_name = serializers.SerializerMethodField()
    edit_history = serializers.JSONField(read_only=True)
    display_client_type = serializers.SerializerMethodField()

    class Meta:
        model = CSMFeedback
        fields = [
            'id', 'user_id', 'session_id',
            'consent_given', 'client_type', 'display_client_type', 'client_type_other', 'date', 'sex', 'age', 'region', 'category',
            'school_level', 'school_name', 'company',
            'litpath_rating', 'research_interests', 'missing_content', 'message_comment',
            'created_at',
            # NEW Admin Fields
            'status', 'admin_category',
            'is_valid', 'validity_remarks',
            'is_doable', 'feasibility_remarks',
            'last_edited_by', 'last_edited_by_name', 'last_edited_at', 'edit_history'
        ]
        read_only_fields = ['id', 'created_at', 'last_edited_by', 'last_edited_by_name', 'last_edited_at', 'edit_history']

    def validate(self, attrs):
        client_type = attrs.get('client_type', getattr(self.instance, 'client_type', None))
        client_type_other = (attrs.get('client_type_other') or getattr(self.instance, 'client_type_other', '') or '').strip()

        if client_type == 'Others':
            if not client_type_other:
                raise serializers.ValidationError({'client_type_other': 'Please specify the client type when Others is selected.'})
            attrs['client_type_other'] = client_type_other
        else:
            attrs['client_type_other'] = ''

        return attrs

    def get_last_edited_by_name(self, obj):
        editor = getattr(obj, 'last_edited_by', None)
        if not editor:
            return None
        return editor.full_name or editor.username or editor.email or str(editor.id)

    def get_display_client_type(self, obj):
        if obj.client_type == 'Others' and getattr(obj, 'client_type_other', None):
            return obj.client_type_other
        return obj.client_type