package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class BillService {

    @Autowired
    private BillRepository billRepository;

    public List<BillEntity> getAllBills() {
        return billRepository.findAll();
    }

    public Optional<BillEntity> getBillById(String sapNo) {
        return billRepository.findById(sapNo);
    }

    public BillEntity saveBill(BillEntity bill) {
        return billRepository.save(bill);
    }

    public void deleteBill(String sapNo) {
        billRepository.deleteById(sapNo);
    }
}