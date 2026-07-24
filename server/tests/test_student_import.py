import unittest

from utils.student_import import (
    generate_student_credentials,
    is_expected_format,
    normalize_expected_records,
    normalize_mapped_records,
    parse_csv_document,
    validate_import_students,
)


class StudentImportTests(unittest.TestCase):
    def test_expected_template_parses_and_normalizes(self):
        headers, records = parse_csv_document(
            "first_name,last_name,year_group,tutor_group\nAmina,Khan,Year 10,10AK\n"
        )

        self.assertTrue(is_expected_format(headers))
        self.assertEqual(normalize_expected_records(records), [{
            "firstName": "Amina",
            "lastName": "Khan",
            "yearGroup": "Year 10",
            "tutorGroup": "10AK",
        }])

    def test_ai_mapping_supports_full_name_columns(self):
        _, records = parse_csv_document(
            "Pupil,Year,Tutor\nAmina Khan,10,10AK\n"
        )

        normalized = normalize_mapped_records(records, {
            "firstNameColumn": "",
            "lastNameColumn": "",
            "fullNameColumn": "Pupil",
            "yearGroupColumn": "Year",
            "tutorGroupColumn": "Tutor",
        })

        self.assertEqual(normalized[0]["firstName"], "Amina")
        self.assertEqual(normalized[0]["lastName"], "Khan")
        self.assertEqual(normalized[0]["yearGroup"], "10")

    def test_generated_credentials_are_unique_and_six_digits(self):
        students = [
            {"firstName": "Amina", "lastName": "Khan"},
            {"firstName": "Amina", "lastName": "Khan"},
        ]

        generated = generate_student_credentials(
            students,
            existing_usernames={"amina.khan"},
            existing_emails={"amina.khan@innerperformance.co.uk"},
        )

        self.assertEqual(generated[0]["username"], "amina.khan.2")
        self.assertEqual(generated[1]["username"], "amina.khan.3")
        self.assertTrue(all(item["password"].isdigit() and len(item["password"]) == 6 for item in generated))
        self.assertTrue(all(item["email"].endswith("@innerperformance.co.uk") for item in generated))

    def test_import_validation_reports_duplicate_and_bad_password(self):
        students = [
            {
                "rowNumber": 2,
                "firstName": "Amina",
                "lastName": "Khan",
                "username": "amina.khan",
                "email": "amina.khan@innerperformance.co.uk",
                "password": "123456",
            },
            {
                "rowNumber": 3,
                "firstName": "Ben",
                "lastName": "Jones",
                "username": "amina.khan",
                "email": "ben@example.com",
                "password": "123",
            },
        ]

        _, errors = validate_import_students(students)

        self.assertEqual(len(errors), 1)
        self.assertIn("username", errors[0]["fields"])
        self.assertIn("email", errors[0]["fields"])
        self.assertIn("password", errors[0]["fields"])


if __name__ == "__main__":
    unittest.main()
