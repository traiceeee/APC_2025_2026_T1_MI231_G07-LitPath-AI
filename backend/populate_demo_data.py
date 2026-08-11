#!/usr/bin/env python3
"""
Script to populate the PostgreSQL database with sample data for demonstration purposes.
This script adds realistic CSM feedback entries, general feedback, and material data.
"""

import os
import sys
import django
import random
from datetime import datetime, timedelta
from decimal import Decimal

# Setup Django environment
sys.path.append('/home/apcadmin/Documents/APC_2025_2026_T1_MI231_G07-LitPath-AI/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'litpath_backend.settings')

django.setup()

from rag_api.models import CSMFeedback, Feedback, Material
from django.utils import timezone


def populate_csm_feedback():
    """Populate CSM feedback table with sample data"""
    print("Populating CSM Feedback data...")

    client_types = ['Others', 'Business', 'Government']
    sexes = ['Female', 'Male', 'Prefer not to say']
    ages = ['16-20', '21-25', '26-30', '31-35', '36-40', '41-45']
    regions = ['NCR', 'R03', 'R04A', 'R06', 'R07', 'R10', 'R11']
    categories = ['Student', 'DOST Employee', 'Other Government Employee', 'Librarian/Library Staff', 'Teaching Personnel', 'Administrative Personnel', 'Researcher']
    ratings = [1, 2, 3, 4, 5]

    admin_categories = ['Bug', 'Feature Request', 'Content Request', 'Compliment', 'Issue / Bug', 'For Improvement']
    statuses = ['Pending', 'Reviewed', 'Resolved']

    research_interests_options = [
        'Renewable energy sources',
        'Biomedical engineering',
        'Computer science applications',
        'Environmental science',
        'Nanotechnology',
        'Marine biodiversity',
        'Climate change impacts',
        'Food security solutions',
        'Disaster risk reduction',
        'Public health initiatives',
        'Agricultural technology',
        'Water resource management',
        'Urban planning',
        'Education technology',
        'Artificial intelligence'
    ]

    missing_content_options = [
        'More recent studies on renewable energy',
        'Information on climate adaptation strategies',
        'Research on agricultural pest control',
        'Studies on urban development',
        'Data on public health interventions',
        'Research on marine conservation',
        'Information on disaster preparedness',
        'Studies on education technology',
        'Data on food processing techniques',
        'Research on water purification methods'
    ]

    comments_options = [
        'The search feature is very helpful but could be faster.',
        'Great resource for academic research.',
        'I found exactly what I needed for my thesis.',
        'The interface is intuitive and easy to use.',
        'Could use more materials from the last 5 years.',
        'The citation generator is very convenient.',
        'Some documents seem to be missing from the collection.',
        'The AI assistant is quite helpful for finding relevant materials.',
        'I appreciate the multilingual support.',
        'Would love to see more content on environmental topics.',
        'The search results are very accurate.',
        'The download speed could be improved.',
        'Excellent resource for researchers.',
        'I encountered some broken links during my research.',
        'The recommendation system is impressive.'
    ]

    for i in range(100):  # Create 100 sample CSM feedback entries
        # Randomly select values
        client_type = random.choice(client_types)
        sex = random.choice(sexes)
        age = random.choice(ages)
        region = random.choice(regions)
        category = random.choice(categories)
        rating = random.choice(ratings)

        # Calculate date (random date within the past year)
        days_back = random.randint(1, 365)
        feedback_date = (datetime.now() - timedelta(days=days_back)).date()

        # Create research interests text
        research_interests = ', '.join(random.sample(research_interests_options, random.randint(1, 3)))

        # Create missing content text
        missing_content = random.choice(missing_content_options) if random.random() > 0.3 else None

        # Create comment
        comment = random.choice(comments_options) if random.random() > 0.2 else None

        # Admin triage info
        admin_category = random.choice(admin_categories) if random.random() > 0.4 else None
        status = random.choice(statuses)

        # Validity and feasibility (only set if status is not pending)
        is_valid = random.choice([True, False]) if status != 'Pending' else None
        validity_remarks = f"This feedback {'is' if is_valid else 'is not'} valid and important." if is_valid is not None else None

        is_doable = random.choice([True, False]) if status != 'Pending' else None
        feasibility_remarks = f"This request {'is' if is_doable else 'is not'} feasible to implement." if is_doable is not None else None

        # Create and save the feedback entry
        csm_feedback = CSMFeedback(
            user_id=f"user_{i+1000}",
            session_id=f"session_{i+2000}",
            consent_given=random.choice([True, False]),
            client_type=client_type,
            date=feedback_date,
            sex=sex,
            age=age,
            region=region,
            category=category,
            litpath_rating=rating,
            research_interests=research_interests,
            missing_content=missing_content,
            message_comment=comment,
            status=status,
            admin_category=admin_category,
            is_valid=is_valid,
            validity_remarks=validity_remarks,
            is_doable=is_doable,
            feasibility_remarks=feasibility_remarks
        )

        csm_feedback.save()
        print(f"Created CSM Feedback #{i+1}")

    print("Successfully populated CSM Feedback data!")


def populate_general_feedback():
    """Populate general feedback table with sample data"""
    print("Populating General Feedback data...")

    statuses = ['Pending', 'Reviewed', 'Resolved']
    categories = ['Positive', 'Issue', 'For Improvement']

    queries = [
        'renewable energy policies',
        'biomedical applications',
        'computer science algorithms',
        'environmental protection',
        'nanotechnology applications',
        'marine biology research',
        'climate change studies',
        'food security solutions',
        'disaster management',
        'public health data',
        'agricultural innovations',
        'water resource management',
        'urban planning',
        'education technology',
        'artificial intelligence ethics'
    ]

    comments = [
        'Very helpful results',
        'Found what I needed',
        'Results were not relevant',
        'Interface is great',
        'Could use more filters',
        'Fast search experience',
        'Accurate recommendations',
        'Some documents missing',
        'Excellent resource',
        'Needs improvement in search',
        'Great for academic research',
        'User-friendly design',
        'Good quality results',
        'More recent data needed',
        'Citation feature helpful'
    ]

    for i in range(50):  # Create 50 sample feedback entries
        # Randomly select values
        query = random.choice(queries)
        rating = random.randint(1, 5)
        relevant = random.choice([True, False])
        comment = random.choice(comments) if random.random() > 0.3 else None
        status = random.choice(statuses)
        category = random.choice(categories) if random.random() > 0.4 else None

        # Validity and feasibility (only set if status is not pending)
        is_valid = random.choice([True, False]) if status != 'Pending' else None
        validity_remarks = f"This feedback {'is' if is_valid else 'is not'} valid." if is_valid is not None else None

        is_doable = random.choice([True, False]) if status != 'Pending' else None
        feasibility_remarks = f"This request {'is' if is_doable else 'is not'} doable." if is_doable is not None else None

        # Create and save the feedback entry
        feedback = Feedback(
            user_id=f"user_{i+3000}",
            query=query,
            rating=rating,
            relevant=relevant,
            comment=comment,
            status=status,
            category=category,
            is_valid=is_valid,
            validity_remarks=validity_remarks,
            is_doable=is_doable,
            feasibility_remarks=feasibility_remarks
        )

        feedback.save()
        print(f"Created General Feedback #{i+1}")

    print("Successfully populated General Feedback data!")


def populate_materials():
    """Populate materials table with sample data"""
    print("Populating Materials data...")

    titles = [
        'Sustainable Energy Solutions for Rural Philippines',
        'Impact of Climate Change on Philippine Agriculture',
        'Machine Learning Applications in Healthcare Diagnostics',
        'Marine Biodiversity Conservation in Southeast Asia',
        'Urban Planning Strategies for Smart Cities',
        'Biodegradable Plastics from Agricultural Waste',
        'E-Governance Systems for Public Service Delivery',
        'Aquaculture Innovations for Food Security',
        'Renewable Energy Integration in Island Communities',
        'Digital Libraries and Academic Research Enhancement',
        'Waste Management Technologies for Metro Manila',
        'Precision Farming Techniques Using IoT Sensors',
        'Disaster Risk Reduction Through Early Warning Systems',
        'Nutritional Quality of Biofortified Rice Varieties',
        'Blockchain Applications in Supply Chain Management'
    ]

    authors = [
        'Santos, Maria C.',
        'Reyes, Juan D.',
        'Garcia, Ana L.',
        'Fernandez, Carlos M.',
        'Rodriguez, Elena P.',
        'Lim, David S.',
        'Chen, Wei X.',
        'Torres, Roberto A.',
        'Villa, Patricia J.',
        'Hernandez, Miguel K.',
        'Castro, Lisa N.',
        'Wong, James Y.',
        'Tan, Francis R.',
        'Co, Jennifer T.',
        'Lopez, Ricardo U.'
    ]

    degrees = [
        'Bachelor of Science in Computer Science',
        'Master of Science in Environmental Engineering',
        'PhD in Agricultural Biotechnology',
        'Master of Arts in Public Administration',
        'Bachelor of Science in Marine Biology',
        'Doctor of Philosophy in Economics',
        'Master of Engineering in Renewable Energy',
        'Bachelor of Science in Nursing',
        'PhD in Materials Science',
        'Master of Science in Urban Planning',
        'Bachelor of Science in Chemistry',
        'Master of Science in Information Technology',
        'PhD in Social Sciences',
        'Master of Business Administration',
        'Bachelor of Science in Physics'
    ]

    schools = [
        'University of the Philippines Diliman',
        'Ateneo de Manila University',
        'De La Salle University',
        'Mapúa University',
        'Polytechnic University of the Philippines',
        'Far Eastern University',
        'Lyceum of the Philippines University',
        'Adamson University',
        'Technological Institute of the Philippines',
        'Centro Escolar University',
        'University of Santo Tomas',
        'Philippine Normal University',
        'Pamantasan ng Lungsod ng Maynila',
        'Bulacan State University',
        'Cebu Technological University'
    ]

    subjects_base = [
        'Computer Science',
        'Environmental Science',
        'Agriculture',
        'Public Policy',
        'Marine Biology',
        'Economics',
        'Energy Systems',
        'Healthcare',
        'Urban Development',
        'Materials Engineering',
        'Chemistry',
        'Information Technology',
        'Social Sciences',
        'Business Administration',
        'Physics',
        'Mathematics',
        'Biology',
        'Chemical Engineering',
        'Civil Engineering',
        'Electronics Engineering'
    ]

    for i in range(50):  # Create 50 sample materials
        title = random.choice(titles)
        author = random.choice(authors)
        year = random.randint(2018, 2026)
        degree = random.choice(degrees)
        school = random.choice(schools)

        # Generate 3-6 random subjects for each material
        subjects = random.sample(subjects_base, random.randint(3, 6))

        # Create abstract
        random_subject = random.choice(subjects_base)
        abstract = f"This study examines various aspects of {title.lower()}. The research employed both quantitative and qualitative methodologies to analyze key factors affecting {random_subject.lower()}. Results indicate significant improvements in efficiency and effectiveness when implementing the proposed solutions. The findings contribute to the growing body of knowledge on sustainable development practices in the {random_subject.lower()} sector."

        # Create file name
        file_name = f"thesis_{i+1:03d}_{title.lower().replace(' ', '_')[:30]}.pdf"

        # Create and save the material
        material = Material(
            file=file_name,
            title=title,
            author=author,
            year=year,
            abstract=abstract,
            degree=degree,
            subjects=subjects,
            school=school
        )

        material.save()
        print(f"Created Material #{i+1}: {title}")

    print("Successfully populated Materials data!")


if __name__ == '__main__':
    print("Starting to populate database with sample data...")

    try:
        # Populate all tables
        populate_csm_feedback()
        populate_general_feedback()
        populate_materials()

        print("\nDatabase successfully populated with sample data!")
        print("- 100 CSM Feedback entries")
        print("- 50 General Feedback entries") 
        print("- 50 Material entries")

    except Exception as e:
        print(f"An error occurred while populating the database: {e}")
        import traceback
        traceback.print_exc()