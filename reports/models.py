from django.db import models
from django.utils import timezone


class ReportUpload(models.Model):
	"""Stores metadata about each report upload including date range."""
	start_date = models.DateField(null=False, blank=False, help_text="Start date of the reporting period")
	end_date = models.DateField(null=False, blank=False, help_text="End date of the reporting period")
	upload_date = models.DateTimeField(default=timezone.now, auto_now_add=False, help_text="When the report was uploaded")
	total_weeks = models.FloatField(default=1.0, null=False, help_text="Total weeks in the reporting period")
	total_months = models.FloatField(default=1.0, null=False, help_text="Total months in the reporting period")
	
	class Meta:
		ordering = ['-upload_date']
		verbose_name = "Report Upload"
		verbose_name_plural = "Report Uploads"
	
	def __str__(self):
		return f"Report from {self.start_date} to {self.end_date}"


class Member(models.Model):
	"""Stores member information."""
	first_name = models.CharField(max_length=100, blank=True, default='')
	last_name = models.CharField(max_length=100, blank=True, default='')
	full_name = models.CharField(max_length=200, db_index=True, blank=True, default='', help_text="Full name for easy lookup")
	
	class Meta:
		ordering = ['last_name', 'first_name']
		unique_together = ['first_name', 'last_name']
		indexes = [
			models.Index(fields=['full_name']),
		]
	
	def __str__(self):
		return self.full_name or f"{self.first_name} {self.last_name}".strip() or "Unknown Member"
	
	def save(self, *args, **kwargs):
		# Auto-populate full_name if not already set
		if not self.full_name:
			self.full_name = f"{self.first_name} {self.last_name}".strip() or ''
		super().save(*args, **kwargs)


class MemberData(models.Model):
	"""Stores raw member data from Excel upload."""
	report = models.ForeignKey(ReportUpload, on_delete=models.CASCADE, related_name='member_data', null=False, blank=False)
	member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='data_records', null=False, blank=False)
	
	# All the columns from the Excel file
	P = models.IntegerField(default=0, null=False, help_text="Present")
	A = models.IntegerField(default=0, null=False, help_text="Absent")
	L = models.IntegerField(default=0, null=False, help_text="Late")
	M = models.IntegerField(default=0, null=False, help_text="Meetings")
	S = models.IntegerField(default=0, null=False, help_text="Substitute")
	RGI = models.IntegerField(default=0, null=False, help_text="Referrals Given In")
	RGO = models.IntegerField(default=0, null=False, help_text="Referrals Given Out")
	RRI = models.IntegerField(default=0, null=False, help_text="Referrals Received In")
	RRO = models.IntegerField(default=0, null=False, help_text="Referrals Received Out")
	V = models.IntegerField(default=0, null=False, help_text="Visitors")
	one_to_one = models.IntegerField(default=0, null=False, help_text="1-2-1")
	TYFCB = models.IntegerField(default=0, null=False, help_text="Total Yearly Fees Collected by")
	CEU = models.IntegerField(default=0, null=False, help_text="Continuing Education Units")
	T = models.IntegerField(default=0, null=False, help_text="Testimonials")
	
	class Meta:
		ordering = ['member__last_name', 'member__first_name']
		unique_together = ['report', 'member']
		indexes = [
			models.Index(fields=['report']),
			models.Index(fields=['member']),
		]
	
	def __str__(self):
		return f"{self.member.full_name} - {self.report}"


class TrainingData(models.Model):
	"""Stores training data count for each member in a report."""
	report = models.ForeignKey(ReportUpload, on_delete=models.CASCADE, related_name='training_data', null=False, blank=False)
	member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='training_records', null=False, blank=False)
	count = models.IntegerField(default=0, null=False, help_text="Number of training occurrences")
	
	class Meta:
		ordering = ['member__last_name', 'member__first_name']
		unique_together = ['report', 'member']
		indexes = [
			models.Index(fields=['report']),
			models.Index(fields=['member']),
		]
	
	def __str__(self):
		return f"{self.member.full_name} - {self.count} training(s)"

