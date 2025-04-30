# TP Jour 1 : Fondamentaux et déploiement d'applications OpenShift

## Objectifs du TP
- Prendre en main l'environnement OpenShift
- Déployer une application web simple
- Configurer et gérer des déploiements
- Construire et publier une image personnalisée

## Prérequis
- Accès à un cluster OpenShift
- Outil CLI `oc` installé
- Connaissances de base en conteneurs et Kubernetes

## Durée estimée
3 heures

## Partie 1 : Prise en main de l'environnement OpenShift

### 1.1 Connexion à l'environnement

1. Connectez-vous à la console web OpenShift avec les identifiants fournis
2. Explorez l'interface utilisateur et identifiez les sections principales
3. Ouvrez un terminal et connectez-vous via l'outil CLI :
   ```bash
   oc login <URL_API> -u <username> -p <password>
   ```
4. Vérifiez la connexion en affichant les informations du cluster :
   ```bash
   oc cluster-info
   oc get nodes
   oc version
   ```

### 1.2 Création d'un projet

1. Créez un nouveau projet pour ce TP :
   ```bash
   oc new-project tp1-<votre-nom> --display-name="TP1 <Votre Nom>" --description="TP Jour 1 - Fondamentaux OpenShift"
   ```
2. Vérifiez que le projet a bien été créé :
   ```bash
   oc projects
   oc project tp1-<votre-nom>
   ```
3. Examinez les quotas et limites du projet (s'ils sont configurés) :
   ```bash
   oc get resourcequota
   oc get limitrange
   ```

## Partie 2 : Déploiement d'une application web

### 2.1 Déploiement à partir d'une image existante

1. Déployez une application web simple à partir d'une image existante :
   ```bash
   oc new-app --name=webapp httpd:2.4 labels=app=web
   ```
2. Suivez le déploiement :
   ```bash
   oc status
   oc get pods -w
   ```
3. Exposez l'application via une route :
   ```bash
   oc expose service/webapp
   ```
4. Récupérez l'URL de la route et accédez à l'application dans votre navigateur :
   ```bash
   oc get route webapp
   ```

### 2.2 Configuration du déploiement

1. Examinez les ressources créées :
   ```bash
   oc get all -l app=webapp
   ```
2. Ajoutez des variables d'environnement :
   ```bash
   oc set env deployment/webapp ENVIRONMENT=production VERSION=1.0
   ```
3. Configurez des limites de ressources :
   ```bash
   oc set resources deployment/webapp --limits=cpu=200m,memory=256Mi --requests=cpu=100m,memory=128Mi
   ```
   ### Ressources allouées au pod

- **Ressources garanties (requests)** :
  - 🧠 **CPU** : 100 millicores (**0,1 vCPU**)
  - 💾 **Mémoire** : 128 MiB

- **Ressources maximales (limits)** :
  - 🧠 **CPU** : 200 millicores (**0,2 vCPU**)
  - 💾 **Mémoire** : 256 MiB

4. Vérifiez les modifications :
   ```bash
   oc describe deployment webapp
   ```

### 2.3 Scaling de l'application

1. Augmentez le nombre de réplicas manuellement :
   ```bash
   oc scale deployment/webapp --replicas=3
   ```
2. Vérifiez que les pods supplémentaires sont créés :
   ```bash
   oc get pods -l app=webapp
   ```
3. Configurez l'autoscaling :
   ```bash
   oc autoscale deployment/webapp --min=2 --max=5 --cpu-percent=80
   ```
4. Vérifiez la configuration de l'autoscaler :
   ```bash
   oc get hpa
   ```

## Partie 3 : Construction d'une image personnalisée

### 3.1 Préparation du code source

1. Créez un répertoire pour votre application :
   ```bash
   mkdir -p ~/custom-app
   cd ~/custom-app
   ```
2. Créez un fichier index.html personnalisé :
   ```bash
   cat > index.html << EOF
   <!DOCTYPE html>
   <html>
   <head>
       <title>Application personnalisée OpenShift</title>
       <style>
           body {
               font-family: Arial, sans-serif;
               margin: 40px;
               background-color: #f5f5f5;
               color: #333;
           }
           .container {
               max-width: 800px;
               margin: 0 auto;
               background-color: white;
               padding: 20px;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
           }
           h1 {
               color: #cc0000;
               border-bottom: 1px solid #eee;
               padding-bottom: 10px;
           }
           .info {
               background-color: #f8f8f8;
               padding: 15px;
               border-left: 4px solid #cc0000;
               margin: 20px 0;
           }
       </style>
   </head>
   <body>
       <div class="container">
           <h1>Application personnalisée sur OpenShift</h1>
           <p>Cette application a été déployée à partir d'une image personnalisée construite sur OpenShift.</p>
           
           <div class="info">
               <p><strong>Informations sur le déploiement :</strong></p>
               <p>Version : 1.0</p>
           </div>
           
           <p>Cette page démontre la construction et le déploiement d'une application personnalisée sur la plateforme OpenShift.</p>
       </div>
   </body>
   </html>
   EOF
   ```
3. Créez un Dockerfile :
   ```bash
   cat > Dockerfile << EOF
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
   EOF
   ```

### 3.2 Construction de l'image avec OpenShift

1. Créez une les ressources BuildConfig et ImageStream à partir du Dockerfile :
   ```bash
   oc new-build --name=custom-app --binary=true --strategy=docker
   ```
2. Démarrez la construction en utilisant les fichiers locaux :
   ```bash
   oc start-build custom-app --from-dir=. --follow
   ```
3. Vérifiez que l'image a été construite avec succès :
   ```bash
   oc get buildconfig
   oc get builds
   oc get imagestream
   ```

### 3.3 Déploiement de l'application personnalisée

1. Créez un déploiement à partir de l'image construite :
   ```bash
   oc new-app --name=custom-webapp custom-app
   ```
2. Exposez l'application via une route :
   ```bash
   oc expose service/custom-webapp
   ```
3. Accédez à l'application dans votre navigateur :
   ```bash
   oc get route custom-webapp
   ```

## Partie 4 : Publication d'images dans le registre OpenShift

### 4.1 Modification et reconstruction de l'image

1. Modifiez le fichier index.html pour ajouter plus d'informations :
   ```bash
   cat > index.html << EOF
   <!DOCTYPE html>
   <html>
   <head>
       <title>Application personnalisée OpenShift - V2</title>
       <style>
           body {
               font-family: Arial, sans-serif;
               margin: 40px;
               background-color: #f5f5f5;
               color: #333;
           }
           .container {
               max-width: 800px;
               margin: 0 auto;
               background-color: white;
               padding: 20px;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
           }
           h1 {
               color: #0066cc;
               border-bottom: 1px solid #eee;
               padding-bottom: 10px;
           }
           .info {
               background-color: #f8f8f8;
               padding: 15px;
               border-left: 4px solid #0066cc;
               margin: 20px 0;
           }
           .footer {
               margin-top: 30px;
               text-align: center;
               font-size: 0.8em;
               color: #666;
           }
       </style>
   </head>
   <body>
       <div class="container">
           <h1>Application personnalisée sur OpenShift - Version 2</h1>
           <p>Cette application a été mise à jour et redéployée sur OpenShift.</p>
           
           <div class="info">
               <p><strong>Informations sur le déploiement :</strong></p>
               <p>Version : 2.0</p>
               <p>Environnement : Production</p>
           </div>
           
           <p>Cette page démontre la mise à jour d'une application personnalisée sur la plateforme OpenShift.</p>
           
           <div class="footer">
               <p>Formation RedHat OpenShift - TP Jour 1</p>
           </div>
       </div>
   </body>
   </html>
   EOF
   ```
2. Démarrez une nouvelle construction :
   ```bash
   oc start-build custom-app --from-dir=. --follow
   ```
3. Vérifiez que le déploiement est automatiquement mis à jour :
   ```bash
   oc get pods -w
   ```
4. Rafraîchissez la page dans votre navigateur pour voir les changements.

### 4.2 Gestion des versions d'images

1. Taguez l'image avec une version spécifique :
   ```bash
   oc tag custom-app:latest custom-app:v2
   ```
2. Vérifiez les tags disponibles :
   ```bash
   oc get is custom-app
   ```
3. Déployez une version spécifique de l'application :
   ```bash
   oc new-app --name=custom-webapp-v2 custom-app:v2
   oc expose service/custom-webapp-v2
   ```
4. Comparez les deux versions déployées.

## Partie 5 : Nettoyage et conclusion

1. Listez toutes les ressources créées dans le projet :
   ```bash
   oc get all
   ```
2. Supprimez les applications déployées :
   ```bash
   oc delete all -l app=webapp
   oc delete all -l app=custom-webapp
   oc delete all -l app=custom-webapp-v2
   ```
3. Vérifiez que les ressources ont bien été supprimées :
   ```bash
   oc get all
   ```

## Questions de réflexion

1. Quels sont les avantages d'utiliser OpenShift par rapport à Kubernetes natif pour le déploiement d'applications ?
2. Comment OpenShift facilite-t-il la construction et la publication d'images de conteneurs ?
3. Quelles stratégies pourriez-vous mettre en place pour gérer efficacement les différentes versions de vos applications ?
4. Comment pourriez-vous améliorer la sécurité des images de conteneurs que vous avez construites ?

## Ressources supplémentaires

- [Documentation officielle Red Hat OpenShift](https://docs.openshift.com/)
- [Guide des bonnes pratiques pour les images de conteneurs](https://docs.openshift.com/container-platform/4.10/openshift_images/create-images.html)
- [Stratégies de déploiement dans OpenShift](https://docs.openshift.com/container-platform/4.10/applications/deployments/deployment-strategies.html)
