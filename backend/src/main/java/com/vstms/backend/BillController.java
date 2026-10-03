package com.vstms.backend;

import com.vstms.backend.model.BillDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
    public BillDTO createBill(@RequestBody BillRequest request) {
        BillDTO bill = new BillDTO(
                request.getSapNo(),
                request.getDate(),
                request.getSpmCenter(),
                request.getTotalTransformers(),
                request.getBillAmount()
        );
        return googleSheetsService.saveBill(bill);
    }

    @PutMapping("/{sapNo}")
    public ResponseEntity<BillDTO> updateBill(@PathVariable String sapNo, @RequestBody BillRequest request) {
        return googleSheetsService.getBillById(sapNo)
                .map(bill -> {
                    bill.setDate(request.getDate());
                    bill.setSpmCenter(request.getSpmCenter());
                    bill.setTotalTransformers(request.getTotalTransformers());
                    bill.setBillAmount(request.getBillAmount());
                    return ResponseEntity.ok(googleSheetsService.saveBill(bill));
                })
                .orElse(ResponseEntity.notFound().build());
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
        private String sapNo;
        private LocalDate date;
        private String spmCenter;
        private int totalTransformers;
        private Double billAmount;

        public String getSapNo() {
            return sapNo;
        }

        public void setSapNo(String sapNo) {
            this.sapNo = sapNo;
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
    }
}