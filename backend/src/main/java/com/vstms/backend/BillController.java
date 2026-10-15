package com.vstms.backend;

import com.vstms.backend.model.BillDTO;
import com.vstms.backend.model.AttachmentDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/bills")
public class BillController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public List<BillDTO> getAllBills() {
        return googleSheetsService.getAllBills();
    }

    @GetMapping("/{sapNo}")
    public ResponseEntity<BillDTO> getBillById(@PathVariable String sapNo) {
        return googleSheetsService.getBillById(sapNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public BillDTO createBill(@Valid @RequestBody BillRequest request) {
        BillDTO bill = new BillDTO(
                request.getSapNo().trim(),
                request.getDate(),
                request.getSpmCenter(),
                request.getTotalTransformers(),
                request.getBillAmount()
        );
        if (request.getAgreementNo() != null) {
            bill.setAgreementNo(request.getAgreementNo().trim());
        }
        if (request.getSpmCenter() != null) {
            bill.setSpmCenter(request.getSpmCenter().trim());
        }
        if (request.getGstAmount() != null) {
            bill.setGstAmount(request.getGstAmount());
        }
        bill.setAttachments(request.getAttachments());
        return googleSheetsService.saveBill(bill);
    }

    @PutMapping("/{sapNo}")
    public ResponseEntity<BillDTO> updateBill(@PathVariable String sapNo, @Valid @RequestBody BillRequest request) {
        return googleSheetsService.getBillById(sapNo)
                .map(bill -> {
                    bill.setDate(request.getDate());
                    if (request.getAgreementNo() != null) {
                        bill.setAgreementNo(request.getAgreementNo().trim());
                    }
                    bill.setSpmCenter(request.getSpmCenter().trim());
                    bill.setTotalTransformers(request.getTotalTransformers());
                    bill.setBillAmount(request.getBillAmount());
                    if (request.getGstAmount() != null) {
                        bill.setGstAmount(request.getGstAmount());
                    }
                    if (request.getAttachments() != null) {
                        bill.setAttachments(request.getAttachments());
                    }
                    return ResponseEntity.ok(googleSheetsService.saveBill(bill));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/status")
    public ResponseEntity<BillDTO> updateBillStatus(
            @RequestBody BillStatusRequest request) {
        return updateBillStatus(request.getSapNo(), request);
    }

    @PatchMapping("/{sapNo}/status")
    public ResponseEntity<BillDTO> updateBillStatusBySapNo(
            @PathVariable String sapNo,
            @RequestBody BillStatusRequest request) {
        return updateBillStatus(sapNo, request);
    }

    private ResponseEntity<BillDTO> updateBillStatus(String sapNo, BillStatusRequest request) {
        if (sapNo == null || sapNo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SAP number is required.");
        }
        BillDTO bill = googleSheetsService.getBillById(sapNo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
        String currentStatus = bill.getStatus() == null ? "PENDING" : bill.getStatus().toUpperCase();
        String nextStatus = request.getStatus() == null ? "" : request.getStatus().toUpperCase();

        if ("RECEIVED".equals(nextStatus) && "PENDING".equals(currentStatus)) {
            if (request.getAmountCredited() == null || request.getAmountCredited() <= 0 ||
                    request.getCreditedDate() == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Enter a credited amount greater than zero and the credited date.");
            }
            bill.setAmountCredited(request.getAmountCredited());
            bill.setCreditedDate(request.getCreditedDate());
        } else if ("GST_FILED".equals(nextStatus) && "RECEIVED".equals(currentStatus)) {
            if (request.getGstFilingMonth() == null || !request.getGstFilingMonth().matches("\\d{4}-(0[1-9]|1[0-2])") ||
                    request.getInvoiceNo() == null || request.getInvoiceNo().isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Enter the GST filing month and invoice number.");
            }
            bill.setGstFilingMonth(request.getGstFilingMonth());
            bill.setInvoiceNo(request.getInvoiceNo().trim());
        } else {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bill status can only progress from Pending to Received, then to GST Filed.");
        }

        bill.setStatus(nextStatus);
        return ResponseEntity.ok(googleSheetsService.updateBill(bill));
    }

    @DeleteMapping("/{sapNo}")
    public ResponseEntity<Void> deleteBill(@PathVariable String sapNo) {
        if (googleSheetsService.getBillById(sapNo).isPresent()) {
            googleSheetsService.deleteBill(sapNo);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class BillRequest {
        @NotBlank
        private String sapNo;
        @NotBlank
        private String agreementNo;
        @NotNull
        private LocalDate date;
        @NotBlank
        private String spmCenter;
        @Min(1)
        private int totalTransformers;
        @NotNull
        @DecimalMin("0.0")
        private Double billAmount;
        @NotNull
        @DecimalMin("0.0")
        private Double gstAmount;
        private List<AttachmentDTO> attachments;

        public String getSapNo() {
            return sapNo;
        }

        public void setSapNo(String sapNo) {
            this.sapNo = sapNo;
        }

        public String getAgreementNo() {
            return agreementNo;
        }

        public void setAgreementNo(String agreementNo) {
            this.agreementNo = agreementNo;
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

        public Double getBillAmount() {
            return billAmount;
        }

        public void setBillAmount(Double billAmount) {
            this.billAmount = billAmount;
        }

        public Double getGstAmount() {
            return gstAmount;
        }

        public void setGstAmount(Double gstAmount) {
            this.gstAmount = gstAmount;
        }

        public List<AttachmentDTO> getAttachments() {
            return attachments;
        }

        public void setAttachments(List<AttachmentDTO> attachments) {
            this.attachments = attachments;
        }
    }

    public static class BillStatusRequest {
        private String sapNo;
        private String status;
        private Double amountCredited;
        private LocalDate creditedDate;
        private String gstFilingMonth;
        private String invoiceNo;

        public String getSapNo() {
            return sapNo;
        }

        public void setSapNo(String sapNo) {
            this.sapNo = sapNo;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Double getAmountCredited() {
            return amountCredited;
        }

        public void setAmountCredited(Double amountCredited) {
            this.amountCredited = amountCredited;
        }

        public LocalDate getCreditedDate() {
            return creditedDate;
        }

        public void setCreditedDate(LocalDate creditedDate) {
            this.creditedDate = creditedDate;
        }

        public String getGstFilingMonth() {
            return gstFilingMonth;
        }

        public void setGstFilingMonth(String gstFilingMonth) {
            this.gstFilingMonth = gstFilingMonth;
        }

        public String getInvoiceNo() {
            return invoiceNo;
        }

        public void setInvoiceNo(String invoiceNo) {
            this.invoiceNo = invoiceNo;
        }
    }
}