package com.vstms.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class TransformerDTO {
    private Long id;
    private String spmCenter;
    private String dtrNo;
    private String sNo;
    private int capacity;
    private String type;
    private double oilCapacity;
    private String status;
    private Long tNoteId;
    private String dcNo;
    private String sapNo;
    private String createdAt;
    private String intakeType;
    private String visitStatus;
    private Boolean billable;
    private AssessmentDetailsDTO assessmentDetails;
    private int assessmentRound;

    public TransformerDTO() {
    }

    public TransformerDTO(Long id, String spmCenter, String dtrNo, String sNo, int capacity, String type,
            double oilCapacity, String status, Long tNoteId, String dcNo, String sapNo) {
        this.id = id;
        this.spmCenter = spmCenter;
        this.dtrNo = dtrNo;
        this.sNo = sNo;
        this.capacity = capacity;
        this.type = type;
        this.oilCapacity = oilCapacity;
        this.status = status;
        this.tNoteId = tNoteId;
        this.dcNo = dcNo;
        this.sapNo = sapNo;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSpmCenter() {
        return spmCenter;
    }

    public void setSpmCenter(String spmCenter) {
        this.spmCenter = spmCenter;
    }

    public String getDtrNo() {
        return dtrNo;
    }

    public void setDtrNo(String dtrNo) {
        this.dtrNo = dtrNo;
    }

    @JsonProperty("sNo")
    public String getSNo() {
        return sNo;
    }

    @JsonProperty("sNo")
    public void setSNo(String sNo) {
        this.sNo = sNo;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getOilCapacity() {
        return oilCapacity;
    }

    public void setOilCapacity(double oilCapacity) {
        this.oilCapacity = oilCapacity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @JsonProperty("tNoteId")
    public Long getTNoteId() {
        return tNoteId;
    }

    @JsonProperty("tNoteId")
    public void setTNoteId(Long tNoteId) {
        this.tNoteId = tNoteId;
    }

    public String getDcNo() {
        return dcNo;
    }

    public void setDcNo(String dcNo) {
        this.dcNo = dcNo;
    }

    public String getSapNo() {
        return sapNo;
    }

    public void setSapNo(String sapNo) {
        this.sapNo = sapNo;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getIntakeType() {
        return intakeType;
    }

    public void setIntakeType(String intakeType) {
        this.intakeType = intakeType;
    }

    public String getVisitStatus() {
        return visitStatus;
    }

    public void setVisitStatus(String visitStatus) {
        this.visitStatus = visitStatus;
    }

    public Boolean getBillable() {
        return billable;
    }

    public void setBillable(Boolean billable) {
        this.billable = billable;
    }

    public AssessmentDetailsDTO getAssessmentDetails() {
        return assessmentDetails;
    }

    public void setAssessmentDetails(AssessmentDetailsDTO assessmentDetails) {
        this.assessmentDetails = assessmentDetails;
    }

    public int getAssessmentRound() {
        return assessmentRound;
    }

    public void setAssessmentRound(int assessmentRound) {
        this.assessmentRound = assessmentRound;
    }
}