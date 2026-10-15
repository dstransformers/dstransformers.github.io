package com.vstms.backend.model;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;

public class AssessmentDetailsDTO {
    @NotBlank
    @Pattern(regexp = "Al|CU")
    private String windingMaterial;

    @NotNull
    private LocalDate firstInspectionDate;

    @Min(0)
    private Integer hvDamagedCoils;
    @DecimalMin("0")
    private Double hvOldCoilWeight;
    @DecimalMin("0")
    private Double hvNewCoilWeight;
    @Min(0)
    private Integer lvReinsulatedCoils;
    @DecimalMin("0")
    private Double lvOldCoilWeight;
    @DecimalMin("0")
    private Double lvNewCoilWeight;
    @Min(0)
    private Integer bushingsLv;
    @Min(0)
    private Integer bushingsHv;
    @Min(0)
    private Integer bushRodsLv;
    @Min(0)
    private Integer bushRodsHv;
    @Min(0)
    private Integer metalPartsHv;
    @Min(0)
    private Integer metalPartsLv;
    @Min(0)
    private Integer breakers;
    @DecimalMin("0")
    private Double oilCapacity;
    @DecimalMin("0")
    private Double oilLess;
    private String remarks;

    public String getWindingMaterial() { return windingMaterial; }
    public void setWindingMaterial(String windingMaterial) { this.windingMaterial = windingMaterial; }
    public LocalDate getFirstInspectionDate() { return firstInspectionDate; }
    public void setFirstInspectionDate(LocalDate firstInspectionDate) { this.firstInspectionDate = firstInspectionDate; }
    public Integer getHvDamagedCoils() { return hvDamagedCoils; }
    public void setHvDamagedCoils(Integer hvDamagedCoils) { this.hvDamagedCoils = hvDamagedCoils; }
    public Double getHvOldCoilWeight() { return hvOldCoilWeight; }
    public void setHvOldCoilWeight(Double hvOldCoilWeight) { this.hvOldCoilWeight = hvOldCoilWeight; }
    public Double getHvNewCoilWeight() { return hvNewCoilWeight; }
    public void setHvNewCoilWeight(Double hvNewCoilWeight) { this.hvNewCoilWeight = hvNewCoilWeight; }
    public Integer getLvReinsulatedCoils() { return lvReinsulatedCoils; }
    public void setLvReinsulatedCoils(Integer lvReinsulatedCoils) { this.lvReinsulatedCoils = lvReinsulatedCoils; }
    public Double getLvOldCoilWeight() { return lvOldCoilWeight; }
    public void setLvOldCoilWeight(Double lvOldCoilWeight) { this.lvOldCoilWeight = lvOldCoilWeight; }
    public Double getLvNewCoilWeight() { return lvNewCoilWeight; }
    public void setLvNewCoilWeight(Double lvNewCoilWeight) { this.lvNewCoilWeight = lvNewCoilWeight; }
    public Integer getBushingsLv() { return bushingsLv; }
    public void setBushingsLv(Integer bushingsLv) { this.bushingsLv = bushingsLv; }
    public Integer getBushingsHv() { return bushingsHv; }
    public void setBushingsHv(Integer bushingsHv) { this.bushingsHv = bushingsHv; }
    public Integer getBushRodsLv() { return bushRodsLv; }
    public void setBushRodsLv(Integer bushRodsLv) { this.bushRodsLv = bushRodsLv; }
    public Integer getBushRodsHv() { return bushRodsHv; }
    public void setBushRodsHv(Integer bushRodsHv) { this.bushRodsHv = bushRodsHv; }
    public Integer getMetalPartsHv() { return metalPartsHv; }
    public void setMetalPartsHv(Integer metalPartsHv) { this.metalPartsHv = metalPartsHv; }
    public Integer getMetalPartsLv() { return metalPartsLv; }
    public void setMetalPartsLv(Integer metalPartsLv) { this.metalPartsLv = metalPartsLv; }
    public Integer getBreakers() { return breakers; }
    public void setBreakers(Integer breakers) { this.breakers = breakers; }
    public Double getOilCapacity() { return oilCapacity; }
    public void setOilCapacity(Double oilCapacity) { this.oilCapacity = oilCapacity; }
    public Double getOilLess() { return oilLess; }
    public void setOilLess(Double oilLess) { this.oilLess = oilLess; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
