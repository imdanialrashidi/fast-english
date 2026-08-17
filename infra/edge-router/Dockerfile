# syntax=docker/dockerfile:1
# Fast English Podcast — twin edge router (Coolify/Traefik stand-in).
# Disposable local-only verification component; never a production image.
FROM nginx:1.27.5-alpine
COPY nginx.conf /etc/nginx/nginx.conf
RUN chmod 0644 /etc/nginx/nginx.conf \
 && chown nginx:nginx /var/cache/nginx
USER nginx
EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]