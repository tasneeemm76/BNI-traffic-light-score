from django.db import models


class Member(models.Model):
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class ReportingPeriod(models.Model):
    start_date = models.DateField()
    end_date = models.DateField()
    year = models.IntegerField()
    month = models.IntegerField()  # 1-12

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("year", "month")
        indexes = [
            models.Index(fields=["year", "month"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self):
        return f"{self.year}-{str(self.month).zfill(2)} ({self.start_date} to {self.end_date})"


class UploadBatch(models.Model):
    original_filename = models.CharField(max_length=255, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Batch {self.id} - {self.original_filename}"


class MemberMonthlyReport(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="monthly_reports")
    period = models.ForeignKey(ReportingPeriod, on_delete=models.CASCADE, related_name="member_reports")
    batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name="reports", null=True, blank=True)

    P = models.IntegerField(default=0)
    A = models.IntegerField(default=0)
    L = models.IntegerField(default=0)
    M = models.IntegerField(default=0)
    S = models.IntegerField(default=0)
    RGI = models.IntegerField(default=0)
    RGO = models.IntegerField(default=0)
    RRI = models.IntegerField(default=0)
    RRO = models.IntegerField(default=0)
    V = models.IntegerField(default=0)
    one_to_one = models.IntegerField(default=0)
    TYFCB = models.BigIntegerField(default=0)
    CEU = models.IntegerField(default=0)
    T = models.IntegerField(default=0)

    # Optional computed fields for convenience
    total_score = models.IntegerField(default=0)
    color = models.CharField(max_length=10, default="GREY")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("member", "period", "batch")
        indexes = [
            models.Index(fields=["member", "period", "batch"]),
            models.Index(fields=["color"]),
        ]

    def __str__(self):
        return f"{self.member} @ {self.period}: {self.total_score} {self.color}"
