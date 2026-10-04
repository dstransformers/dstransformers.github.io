package com.vstms.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class FirebaseBearerTokenFilter extends OncePerRequestFilter {
    private static final System.Logger LOGGER = System.getLogger(FirebaseBearerTokenFilter.class.getName());

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
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length()).trim();
            if (!token.isEmpty()) {
                tokenVerifier.verifyAdminToken(token).ifPresent(email -> {
                    var authentication = new UsernamePasswordAuthenticationToken(
                            email, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
            }
        } else if (requiresAdmin(request)) {
            LOGGER.log(System.Logger.Level.WARNING,
                    "Protected API request rejected because the bearer token is missing.");
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
