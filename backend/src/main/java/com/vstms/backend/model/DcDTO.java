package com.vstms.backend.model;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public class DcDTO {
    private String dcNo;
    private LocalDate date;
    private String spmCenter;
    private int totalTransformers;
    private String customerName;
    private String customerAddress;
    private String customerGstin;
    private String companyGstin;
    private String tNoteNo;
    private Boolean emptyDrumsAvailable;
    private Integer emptyDrumCount;
    private Boolean sentToTgspdcl;
    private List<Map<String, Object>> transformerDetails;
    private Boolean delivered;
    private List<Map<String, Object>> attachments;
    private String deliveredAt;
    private String generatedChallanUrl;
    private String generatedChallanFileId;

    public DcDTO() {
    }

    public DcDTO(String dcNo, LocalDate date, String spmCenter, int totalTransformers) {
        this.dcNo = dcNo;
        this.date = date;
        this.spmCenter = spmCenter;
        this.totalTransformers = totalTransformers;
    }

    public String getDcNo() {
        return dcNo;
    }

    public void setDcNo(String dcNo) {
        this.dcNo = dcNo;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getSpmCenter() {
        return spmCenter;
    }

    public void setSpmCenter(String spmCenter) {
        this.spmCenter = spmCenter;
    }

    public int getTotalTransformers() {
        return totalTransformers;
    }

    public void setTotalTransformers(int totalTransformers) {
        this.totalTransformers = totalTransformers;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerAddress() {
        return customerAddress;
    }

    public void setCustomerAddress(String customerAddress) {
        this.customerAddress = customerAddress;
    }

    public String getCustomerGstin() {
        return customerGstin;
    }

    public void setCustomerGstin(String customerGstin) {
        this.customerGstin = customerGstin;
    }

    public String getCompanyGstin() {
        return companyGstin;
    }

    public void setCompanyGstin(String companyGstin) {
        this.companyGstin = companyGstin;
    }

    public String getTNoteNo() {
        return tNoteNo;
    }

    public void setTNoteNo(String tNoteNo) {
        this.tNoteNo = tNoteNo;
    }

    public Boolean getEmptyDrumsAvailable() {
        return emptyDrumsAvailable;
    }

    public void setEmptyDrumsAvailable(Boolean emptyDrumsAvailable) {
        this.emptyDrumsAvailable = emptyDrumsAvailable;
    }

    public Integer getEmptyDrumCount() {
        return emptyDrumCount;
    }

    public void setEmptyDrumCount(Integer emptyDrumCount) {
        this.emptyDrumCount = emptyDrumCount;
    }

    public Boolean getSentToTgspdcl() {
        return sentToTgspdcl;
    }

    public void setSentToTgspdcl(Boolean sentToTgspdcl) {
        this.sentToTgspdcl = sentToTgspdcl;
    }

    public List<Map<String, Object>> getTransformerDetails() {
        return transformerDetails;
    }

    public void setTransformerDetails(List<Map<String, Object>> transformerDetails) {
        this.transformerDetails = transformerDetails;
    }

    public Boolean getDelivered() {
        return delivered;
    }

    public void setDelivered(Boolean delivered) {
        this.delivered = delivered;
    }

    public List<Map<String, Object>> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<Map<String, Object>> attachments) {
        this.attachments = attachments;
    }

    public String getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(String deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    public String getGeneratedChallanUrl() {
        return generatedChallanUrl;
    }

    public void setGeneratedChallanUrl(String generatedChallanUrl) {
        this.generatedChallanUrl = generatedChallanUrl;
    }

    public String getGeneratedChallanFileId() {
        return generatedChallanFileId;
    }

    public void setGeneratedChallanFileId(String generatedChallanFileId) {
        this.generatedChallanFileId = generatedChallanFileId;
    }
}