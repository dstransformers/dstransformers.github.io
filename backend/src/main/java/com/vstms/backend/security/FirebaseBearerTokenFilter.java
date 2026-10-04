package com.vstms.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

public class FirebaseBearerTokenFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(FirebaseBearerTokenFilter.class);

    private final FirebaseTokenVerifier tokenVerifier;

    public FirebaseBearerTokenFilter(FirebaseTokenVerifier tokenVerifier) {
        this.tokenVerifier = tokenVerifier;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        boolean adminRequired = requiresAdmin(request);
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length()).trim();
            if (!token.isEmpty()) {
                Optional<String> adminEmail = tokenVerifier.verifyAdminToken(token);
                adminEmail.ifPresent(email -> {
                    var authentication = new UsernamePasswordAuthenticationToken(
                            email, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
                if (adminRequired && adminEmail.isEmpty()) {
                    LOGGER.warn(
                            "Protected API request rejected: bearer token did not authenticate an admin; method={}, path={}",
                            request.getMethod(),
                            request.getRequestURI());
                }
            } else if (adminRequired) {
                LOGGER.warn(
                        "Protected API request rejected: empty bearer token; method={}, path={}",
                        request.getMethod(),
                        request.getRequestURI());
            }
        } else if (adminRequired) {
            LOGGER.warn(
                    "Protected API request rejected: missing or unsupported bearer token; method={}, path={}",
                    request.getMethod(),
                    request.getRequestURI());
        }
        filterChain.doFilter(request, response);
    }

    private boolean requiresAdmin(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) return false;
        if ("GET".equals(request.getMethod())
                && ("/api/health".equals(path) || "/api/defaults".equals(path))) {
            return false;
        }
        return !("POST".equals(request.getMethod()) && "/api/enquiries".equals(path));
    }
}
