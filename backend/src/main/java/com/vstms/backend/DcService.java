package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class DcService {

    @Autowired
    private DcRepository dcRepository;

    public List<DcEntity> getAllDCs() {
        return dcRepository.findAll();
    }

    public Optional<DcEntity> getDCById(String dcNo) {
        return dcRepository.findById(dcNo);
    }

    public DcEntity saveDC(DcEntity dc) {
        return dcRepository.save(dc);
    }

    public void deleteDC(String dcNo) {
        dcRepository.deleteById(dcNo);
    }
}