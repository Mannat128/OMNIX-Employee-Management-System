
import re
from pathlib import Path

import easyocr
import fitz
import numpy as np


# Initialize EasyOCR only once
reader = None


def get_ocr_reader():
    global reader

    if reader is None:
        reader = easyocr.Reader(["en"], gpu=False)

    return reader


# Skills to identify in resumes
SKILLS_LIST = [
    "Python", "Java", "JavaScript", "React", "Node.js",
    "FastAPI", "Django", "Flask", "MongoDB", "MySQL",
    "PostgreSQL", "SQL", "HTML", "CSS",
    "Machine Learning", "Deep Learning",
    "Artificial Intelligence", "Data Analysis",
    "Pandas", "NumPy", "Power BI", "Excel",
    "AWS", "Docker", "Git", "GitHub", "C++",
    "C", "TypeScript", "Express.js", "TensorFlow",
    "PyTorch", "Scikit-learn", "Communication"
]


# ---------------- IMAGE OCR ----------------

def extract_text_from_image(image_path):
    ocr_reader = get_ocr_reader()

    results = ocr_reader.readtext(
        str(image_path),
        detail=0,
        paragraph=True
    )

    return "\n".join(results)


# ---------------- PDF OCR ----------------

def extract_text_from_pdf(pdf_path):
    ocr_reader = get_ocr_reader()
    extracted_pages = []

    try:
        pdf_document = fitz.open(pdf_path)

        try:
            if pdf_document.is_encrypted:
                raise ValueError(
                    "Password-protected PDFs are not supported"
                )

            if len(pdf_document) == 0:
                raise ValueError("PDF contains no pages")

            for page in pdf_document:
                pix = page.get_pixmap(
                    matrix=fitz.Matrix(2, 2),
                    alpha=False
                )

                image = np.frombuffer(
                    pix.samples,
                    dtype=np.uint8
                ).reshape(
                    pix.height,
                    pix.width,
                    pix.n
                )

                results = ocr_reader.readtext(
                    image,
                    detail=0,
                    paragraph=True
                )

                extracted_pages.append("\n".join(results))

        finally:
            pdf_document.close()

    except Exception as error:
        raise ValueError(
            f"PDF processing failed: {str(error)}"
        ) from error

    return "\n\n".join(extracted_pages)


# ---------------- COMMON HELPERS ----------------

def clean_lines(text):
    return [
        re.sub(r"\s+", " ", line).strip()
        for line in text.splitlines()
        if line.strip()
    ]


def extract_email(text):
    match = re.search(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text
    )

    return match.group(0).lower() if match else None


def extract_phone(text):
    match = re.search(
        r"(?<!\d)(?:\+91[-.\s]?)?[6-9]\d{9}(?!\d)",
        text
    )

    return match.group(0) if match else None


def extract_date(text):
    match = re.search(
        r"\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|"
        r"\d{4}[-/]\d{1,2}[-/]\d{1,2})\b",
        text
    )

    return match.group(0) if match else None


def extract_name_from_first_lines(text):
    excluded = {
        "resume", "curriculum vitae", "cv",
        "profile", "contact", "personal details"
    }

    for line in clean_lines(text)[:6]:
        if (
            len(line) <= 60
            and line.lower() not in excluded
            and re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,59}", line)
            and "@" not in line
        ):
            return line

    return None


# ---------------- RESUME EXTRACTION ----------------

def extract_resume_data(text):
    lines = clean_lines(text)

    skills = []

    for skill in SKILLS_LIST:
        pattern = (
            r"(?<![A-Za-z0-9])"
            + re.escape(skill)
            + r"(?![A-Za-z0-9])"
        )

        if re.search(pattern, text, re.IGNORECASE):
            skills.append(skill)

    education = []
    experience = []

    education_keywords = (
        "education", "qualification", "university",
        "college", "degree", "bachelor", "master"
    )

    experience_keywords = (
        "experience", "employment", "internship",
        "worked at", "work history"
    )

    for line in lines:
        lower = line.lower()

        if any(word in lower for word in education_keywords):
            education.append(line)

        if any(word in lower for word in experience_keywords):
            experience.append(line)

    return {
        "name": extract_name_from_first_lines(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": skills,
        "education": education,
        "experience": experience
    }


# ---------------- ID PROOF EXTRACTION ----------------

def extract_id_proof_data(text, custom_document_name=None):
    lower = text.lower()
    document_name = (custom_document_name or "").lower()

    # Aadhaar detection from manually entered document name
    # or recognizable text in the document.
    is_aadhaar = (
        "aadhaar" in document_name
        or "aadhar" in document_name
        or "unique identification authority" in lower
        or "government of india" in lower
        and "dob" in lower
    )

    # PAN detection
    is_pan = (
        "pan" in document_name
        or "permanent account number" in lower
    )

    # Driving licence detection
    is_driving_licence = (
        "driving" in document_name
        or "licence" in document_name
        or "license" in document_name
        or "driving licence" in lower
    )

    data = {
        "name": None,
        "date_of_birth": None,
        "gender": None,
        "address": None,
        "document_number": None,
        "document_name": custom_document_name
    }

    lines = clean_lines(text)

    # Masked Aadhaar number only
    if is_aadhaar:
        match = re.search(
            r"(?<!\d)(?:\d{4}[\s-]?){2}\d{4}(?!\d)",
            text
        )

        if match:
            digits = re.sub(r"\D", "", match.group(0))
            data["document_number"] = "XXXX XXXX " + digits[-4:]

    # Masked PAN number only
    elif is_pan:
        match = re.search(
            r"\b[A-Z]{5}\d{4}[A-Z]\b",
            text.upper()
        )

        if match:
            pan = match.group(0)
            data["document_number"] = (
                "XXXXX" + pan[-5:]
            )

    # Driving licence: keep number masked where recognizable
    elif is_driving_licence:
        match = re.search(
            r"\b[A-Z]{2}[- ]?\d{2}[- ]?\d{4,12}\b",
            text.upper()
        )

        if match:
            number = re.sub(r"[^A-Z0-9]", "", match.group(0))
            data["document_number"] = (
                "XXXX" + number[-4:]
            )

    # Common name and date extraction
    for line in lines:
        lower_line = line.lower()

        if not data["name"] and (
            lower_line.startswith("name")
            or lower_line.startswith("नाम")
        ):
            parts = re.split(r"[:\-]", line, maxsplit=1)

            if len(parts) == 2 and parts[1].strip():
                data["name"] = parts[1].strip()

        if not data["date_of_birth"] and any(
            word in lower_line
            for word in ["dob", "date of birth", "birth"]
        ):
            data["date_of_birth"] = extract_date(line)

        if not data["gender"] and any(
            word in lower_line
            for word in ["male", "female", "transgender"]
        ):
            if re.search(r"\bmale\b", lower_line):
                data["gender"] = "Male"
            elif re.search(r"\bfemale\b", lower_line):
                data["gender"] = "Female"
            elif "transgender" in lower_line:
                data["gender"] = "Transgender"

    # Address is not guessed from arbitrary OCR text.
    # It is extracted only when an address-labelled line exists.
    for index, line in enumerate(lines):
        if "address" in line.lower():
            parts = re.split(r"[:\-]", line, maxsplit=1)

            if len(parts) == 2 and parts[1].strip():
                data["address"] = parts[1].strip()
            elif index + 1 < len(lines):
                data["address"] = lines[index + 1]

            break

    data["email"] = extract_email(text)
    data["phone"] = extract_phone(text)

    return data


# ---------------- CERTIFICATE EXTRACTION ----------------

def extract_certificate_data(text, custom_document_name=None):
    lines = clean_lines(text)

    institute_keywords = [
        "university", "college", "institute",
        "school", "academy"
    ]

    course_keywords = [
        "certificate", "course", "training",
        "diploma", "completion", "achievement"
    ]

    institute = next(
        (
            line for line in lines
            if any(word in line.lower() for word in institute_keywords)
        ),
        None
    )

    course = next(
        (
            line for line in lines
            if any(word in line.lower() for word in course_keywords)
        ),
        None
    )

    return {
        "name": extract_name_from_first_lines(text),
        "course_or_certificate": course,
        "institute": institute,
        "issue_date": extract_date(text),
        "document_name": custom_document_name
    }


# ---------------- GENERIC SMART EXTRACTION ----------------

def extract_generic_data(text, custom_document_name=None):
    lines = clean_lines(text)

    sections = {
        "personal_details": [],
        "document_details": [],
        "dates": [],
        "contact_information": [],
        "address_information": [],
        "additional_information": []
    }

    personal_keywords = [
        "name", "father", "mother", "gender",
        "dob", "date of birth"
    ]

    document_keywords = [
        "number", "certificate", "registration",
        "identity", "document", "reference"
    ]

    address_keywords = [
        "address", "village", "district",
        "state", "pin code", "postal"
    ]

    for line in lines:
        lower = line.lower()

        if re.search(
            r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
            line
        ):
            sections["dates"].append(line)

        elif "@" in line or extract_phone(line):
            sections["contact_information"].append(line)

        elif any(word in lower for word in address_keywords):
            sections["address_information"].append(line)

        elif any(word in lower for word in personal_keywords):
            sections["personal_details"].append(line)

        elif any(word in lower for word in document_keywords):
            sections["document_details"].append(line)

        else:
            sections["additional_information"].append(line)

    # Remove empty sections
    sections = {
        key: value
        for key, value in sections.items()
        if value
    }

    return {
        "document_name": custom_document_name,
        "sections": sections
    }


# ---------------- MAIN OCR PROCESSING ----------------

def process_document(
    file_path,
    document_type="resume",
    custom_document_name=None
):
    file_path = Path(file_path)

    if not file_path.is_file():
        raise FileNotFoundError("Document file not found")

    extension = file_path.suffix.lower()

    if extension == ".pdf":
        extracted_text = extract_text_from_pdf(file_path)

    elif extension in [".jpg", ".jpeg", ".png"]:
        extracted_text = extract_text_from_image(file_path)

    else:
        raise ValueError("Unsupported document format")

    if not extracted_text.strip():
        raise ValueError(
            "No text could be extracted from document"
        )

    # Select extraction logic using manual document category
    if document_type == "resume":
        extracted_data = extract_resume_data(extracted_text)

    elif document_type == "id":
        extracted_data = extract_id_proof_data(
            extracted_text,
            custom_document_name
        )

    elif document_type == "certificate":
        extracted_data = extract_certificate_data(
            extracted_text,
            custom_document_name
        )

    elif document_type == "other":
        extracted_data = extract_generic_data(
            extracted_text,
            custom_document_name
        )

    else:
        raise ValueError("Unsupported document type")

    return {
        "document_type": document_type,
        "custom_document_name": custom_document_name,
        "extracted_text": extracted_text,
        "extracted_data": extracted_data
    }
