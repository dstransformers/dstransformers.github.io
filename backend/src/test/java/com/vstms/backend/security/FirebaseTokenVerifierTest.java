package com.vstms.backend.security;

import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FirebaseTokenVerifierTest {
    @Test
    void allowsAnyFirebaseAuthenticatedEmailAddress() {
        assertEquals(
                Optional.of("workshop.user@gmail.com"),
                FirebaseTokenVerifier.firebaseEmail("workshop.user@gmail.com"));
    }

    @Test
    void allowsNonGmailFirebaseEmailAddress() {
        assertEquals(
                Optional.of("workshop.user@example.com"),
                FirebaseTokenVerifier.firebaseEmail("workshop.user@example.com"));
    }

    @Test
    void rejectsMissingEmail() {
        assertEquals(Optional.empty(), FirebaseTokenVerifier.firebaseEmail(null));
        assertEquals(Optional.empty(), FirebaseTokenVerifier.firebaseEmail("  "));
    }
}
