package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class TNoteService {

    @Autowired
    private TNoteRepository tNoteRepository;

    @Autowired
    private TransformerRepository transformerRepository;

    public List<TNoteEntity> getAllTNotes() {
        return tNoteRepository.findAll();
    }

    public Optional<TNoteEntity> getTNoteById(Long id) {
        return tNoteRepository.findById(id);
    }

    public TNoteEntity saveTNote(TNoteEntity tNote) {
        return tNoteRepository.save(tNote);
    }

    public void deleteTNote(Long id) {
        tNoteRepository.deleteById(id);
    }
}