package com.vstms.backend.security;

import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FirebaseTokenVerifierTest {
    @Test
    void allowsAnyFirebaseAuthenticatedGmailAddress() {
        assertEquals(
                Optional.of("workshop.user@gmail.com"),
                FirebaseTokenVerifier.gmailAddress("workshop.user@gmail.com"));
    }

    @Test
    void allowsGmailAddressWithMixedCaseDomain() {
        assertEquals(
                Optional.of("workshop.user@GMAIL.COM"),
                FirebaseTokenVerifier.gmailAddress("workshop.user@GMAIL.COM"));
    }

    @Test
    void rejectsNonGmailAddresses() {
        assertEquals(
                Optional.empty(),
                FirebaseTokenVerifier.gmailAddress("workshop.user@example.com"));
        assertEquals(
                Optional.empty(),
                FirebaseTokenVerifier.gmailAddress("workshop.user@gmail.com.example.com"));
    }

    @Test
    void rejectsMissingEmail() {
        assertEquals(Optional.empty(), FirebaseTokenVerifier.gmailAddress(null));
        assertEquals(Optional.empty(), FirebaseTokenVerifier.gmailAddress("  "));
    }
}
