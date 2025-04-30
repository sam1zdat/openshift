# Utilisation de l'image Nginx officielle compatible avec OpenShift
FROM registry.access.redhat.com/ubi8/nginx-120:latest
# Définition de l'utilisateur root temporairement
USER root
# Copie du fichier HTML dans le répertoire de Nginx
COPY index.html /opt/app-root/src/index.html
# Configuration des permissions pour OpenShift
RUN chown -R 1001:0 /usr/share/nginx && \
    chmod -R g+rw /usr/share/nginx && \
    chmod -R g+rw /var/log/nginx && \
    chmod -R g+rw /etc/nginx
# Passage à l'utilisateur non-root (requis par OpenShift)
USER 1001
# Exposition du port 8080 (standard pour OpenShift)
EXPOSE 8080
# Commande pour démarrer Nginx
CMD ["nginx", "-g", "daemon off;"]
