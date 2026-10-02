package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = "*")
public class BillController {

    @Autowired
    private BillService billService;

    @GetMapping
    public List<BillEntity> getAllBills() {
        return billService.getAllBills();
    }

    @GetMapping("/{sapNo}")
    public ResponseEntity<BillEntity> getBillById(@PathVariable String sapNo) {
        return billService.getBillById(sapNo)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public BillEntity createBill(@RequestBody BillRequest request) {
        BillEntity bill = new BillEntity(
            request.getSapNo(), 
            request.getDate(),
            request.getSpmCenter(),
            request.getTotalTransformers(),
            request.getBillAmount()
        );
        return billService.saveBill(bill);
    }

    @PutMapping("/{sapNo}")
    public ResponseEntity<BillEntity> updateBill(@PathVariable String sapNo, @RequestBody BillRequest request) {
        return billService.getBillById(sapNo)
            .map(bill -> {
                bill.setDate(request.getDate());
                bill.setSpmCenter(request.getSpmCenter());
                bill.setTotalTransformers(request.getTotalTransformers());
                bill.setBillAmount(request.getBillAmount());
                return ResponseEntity.ok(billService.saveBill(bill));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{sapNo}")
    public ResponseEntity<Void> deleteBill(@PathVariable String sapNo) {
        if (billService.getBillById(sapNo).isPresent()) {
            billService.deleteBill(sapNo);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class BillRequest {
        private String sapNo;
        private LocalDate date;
        private String spmCenter;
        private Integer totalTransformers;
        private Double billAmount;

        // getters and setters
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

        public Integer getTotalTransformers() {
            return totalTransformers;
        }

        public void setTotalTransformers(Integer totalTransformers) {
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