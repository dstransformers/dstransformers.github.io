package com.vstms.backend.model;

import java.util.ArrayList;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;

public class EmployeeDTO {
    private Long id;
    @NotBlank
    private String employeeCode;
    @NotBlank
    private String name;
    @NotBlank
    private String department;
    @NotNull
    @PositiveOrZero
    private Double salary;
    private String photoUrl;
    private String photoName;
    private List<AttachmentDTO> supportingDocuments = new ArrayList<>();
    private Boolean active;
    private LocalDate createdAt;
    private LocalDate updatedAt;

    public EmployeeDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmployeeCode() { return employeeCode; }
    public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public Double getSalary() { return salary; }
    public void setSalary(Double salary) { this.salary = salary; }
    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }
    public String getPhotoName() { return photoName; }
    public void setPhotoName(String photoName) { this.photoName = photoName; }
    public List<AttachmentDTO> getSupportingDocuments() { return supportingDocuments; }
    public void setSupportingDocuments(List<AttachmentDTO> supportingDocuments) {
        this.supportingDocuments = supportingDocuments == null ? new ArrayList<>() : supportingDocuments;
    }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDate getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDate createdAt) { this.createdAt = createdAt; }
    public LocalDate getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDate updatedAt) { this.updatedAt = updatedAt; }
}
