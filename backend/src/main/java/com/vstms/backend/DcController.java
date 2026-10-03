package com.vstms.backend;

import com.vstms.backend.model.DcDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/dcs")
public class DcController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public List<DcDTO> getAllDCs() {
        return googleSheetsService.getAllDCs();
    }

    @GetMapping("/{dcNo}")
    public ResponseEntity<DcDTO> getDCById(@PathVariable String dcNo) {
        return googleSheetsService.getDCById(dcNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public DcDTO createDC(@RequestBody DcRequest request) {
        DcDTO dc = new DcDTO(request.getDcNo(), request.getDate(), request.getSpmCenter(), request.getTotalTransformers());
        return googleSheetsService.saveDC(dc);
    }

    @PutMapping("/{dcNo}")
    public ResponseEntity<DcDTO> updateDC(@PathVariable String dcNo, @RequestBody DcRequest request) {
        return googleSheetsService.getDCById(dcNo)
                .map(dc -> {
                    dc.setDate(request.getDate());
                    dc.setSpmCenter(request.getSpmCenter());
                    dc.setTotalTransformers(request.getTotalTransformers());
                    return ResponseEntity.ok(googleSheetsService.saveDC(dc));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{dcNo}")
    public ResponseEntity<Void> deleteDC(@PathVariable String dcNo) {
        if (googleSheetsService.getDCById(dcNo).isPresent()) {
            googleSheetsService.deleteDC(dcNo);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class DcRequest {
        private String dcNo;
        private LocalDate date;
        private String spmCenter;
        private int totalTransformers;

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
    }
}