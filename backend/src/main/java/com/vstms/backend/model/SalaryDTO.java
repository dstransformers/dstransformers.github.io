package com.vstms.backend.model;

import java.time.LocalDate;

public class SalaryDTO {
    private Long id;
    private Long employeeId;
    private String employeeCode;
    private String employeeName;
    private LocalDate month;
    private Double monthlySalary;
    private Double dailyRate;
    private Double overtimeRate;
    private Integer paidDays;
    private Integer holidayCount;
    private Double regularHours;
    private Double overtimeHours;
    private Double regularPay;
    private Double overtimePay;
    private Double totalAmount;
    private String status;
    private LocalDate generatedAt;
    private LocalDate receivedAt;

    public SalaryDTO() {}
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeCode() { return employeeCode; }
    public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public LocalDate getMonth() { return month; }
    public void setMonth(LocalDate month) { this.month = month; }
    public Double getMonthlySalary() { return monthlySalary; }
    public void setMonthlySalary(Double monthlySalary) { this.monthlySalary = monthlySalary; }
    public Double getDailyRate() { return dailyRate; }
    public void setDailyRate(Double dailyRate) { this.dailyRate = dailyRate; }
    public Double getOvertimeRate() { return overtimeRate; }
    public void setOvertimeRate(Double overtimeRate) { this.overtimeRate = overtimeRate; }
    public Integer getPaidDays() { return paidDays; }
    public void setPaidDays(Integer paidDays) { this.paidDays = paidDays; }
    public Integer getHolidayCount() { return holidayCount; }
    public void setHolidayCount(Integer holidayCount) { this.holidayCount = holidayCount; }
    public Double getRegularHours() { return regularHours; }
    public void setRegularHours(Double regularHours) { this.regularHours = regularHours; }
    public Double getOvertimeHours() { return overtimeHours; }
    public void setOvertimeHours(Double overtimeHours) { this.overtimeHours = overtimeHours; }
    public Double getRegularPay() { return regularPay; }
    public void setRegularPay(Double regularPay) { this.regularPay = regularPay; }
    public Double getOvertimePay() { return overtimePay; }
    public void setOvertimePay(Double overtimePay) { this.overtimePay = overtimePay; }
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDate generatedAt) { this.generatedAt = generatedAt; }
    public LocalDate getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDate receivedAt) { this.receivedAt = receivedAt; }
}
