from django import forms

class ExcelUploadForm(forms.Form):
    file = forms.FileField(
        label="Upload File (.xlsx, .xls, or .csv)",
        help_text="Supported formats: Excel (.xlsx, .xls) or CSV (.csv)"
    )
