# TP Jour 2 : Construction et personnalisation d'applications OpenShift

## Objectifs du TP
- Appliquer les principes de conception d'applications cloud-native
- Maîtriser le processus de construction (build) dans OpenShift
- Personnaliser des images Source-to-Image (S2I)
- Créer et utiliser des modèles OpenShift

## Prérequis
- Accès à un cluster OpenShift
- Outil CLI `oc` installé
- Avoir complété le TP du Jour 1

## Durée estimée
3 heures

## Partie 1 : Conception d'applications cloud-native

### 1.1 Analyse d'une application monolithique

1. Clonez le dépôt contenant une application monolithique d'exemple :
   ```bash
   mkdir -p ~/cloud-native
   cd ~/cloud-native
   git clone https://github.com/redhat-developer-demos/monolith-to-microservices.git
   cd monolith-to-microservices
   ```

2. Examinez la structure de l'application :
   ```bash
   ls -la
   cat README.md
   ```

3. Identifiez les composants qui pourraient être séparés en microservices :
   - Créez un document d'analyse :
   ```bash
   cat > architecture-analysis.md << EOF
   # Analyse de l'application monolithique

   ## Composants identifiés
   1. Frontend (interface utilisateur)
   2. Service d'authentification
   3. Service de catalogue de produits
   4. Service de panier d'achat
   5. Service de paiement
   6. Service de gestion des commandes

   ## Dépendances entre composants
   - Le frontend dépend de tous les autres services
   - Le service de panier dépend du service de catalogue
   - Le service de commandes dépend des services de panier et de paiement
   - Le service de paiement dépend du service d'authentification

   ## Architecture microservices proposée
   [Décrivez ici votre proposition d'architecture microservices]
   EOF
   ```

### 1.2 Application des principes de conception

1. Créez un nouveau projet OpenShift :
   ```bash
   oc new-project tp2-cloud-native-<votre-nom>
   ```

2. Créez un document décrivant l'application des principes KISS, DRY, YAGNI et SoC :
   ```bash
   cat > design-principles.md << EOF
   # Application des principes de conception

   ## KISS (Keep It Simple, Stupid)
   - Simplifier les interfaces entre services
   - Utiliser des formats de données standards (JSON)
   - Éviter les dépendances complexes

   ## DRY (Don't Repeat Yourself)
   - Créer une bibliothèque commune pour les fonctions partagées
   - Centraliser la configuration
   - Utiliser des modèles pour les déploiements

   ## YAGNI (You Aren't Gonna Need It)
   - Fonctionnalités à omettre initialement :
     - Système de recommandation avancé
     - Analyses en temps réel
     - Support multi-devises

   ## SoC (Separation of Concerns)
   - Séparation claire entre :
     - Interface utilisateur
     - Logique métier
     - Accès aux données
     - Authentification et autorisation
   EOF
   ```

### 1.3 Conception d'une API REST

1. Concevez une API REST pour le service de catalogue :
   ```bash
   cat > catalog-api.yaml << EOF
   openapi: 3.0.0
   info:
     title: Catalog Service API
     description: API for managing product catalog
     version: 1.0.0
   servers:
     - url: /api/v1
   paths:
     /products:
       get:
         summary: List all products
         parameters:
           - name: category
             in: query
             schema:
               type: string
           - name: limit
             in: query
             schema:
               type: integer
               default: 20
           - name: offset
             in: query
             schema:
               type: integer
               default: 0
         responses:
           '200':
             description: A list of products
             content:
               application/json:
                 schema:
                   type: array
                   items:
                     $ref: '#/components/schemas/Product'
       post:
         summary: Create a new product
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/Product'
         responses:
           '201':
             description: Product created
     /products/{id}:
       get:
         summary: Get a product by ID
         parameters:
           - name: id
             in: path
             required: true
             schema:
               type: string
         responses:
           '200':
             description: A product
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/Product'
           '404':
             description: Product not found
       put:
         summary: Update a product
         parameters:
           - name: id
             in: path
             required: true
             schema:
               type: string
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/Product'
         responses:
           '200':
             description: Product updated
           '404':
             description: Product not found
       delete:
         summary: Delete a product
         parameters:
           - name: id
             in: path
             required: true
             schema:
               type: string
         responses:
           '204':
             description: Product deleted
           '404':
             description: Product not found
   components:
     schemas:
       Product:
         type: object
         required:
           - name
           - price
         properties:
           id:
             type: string
             format: uuid
           name:
             type: string
           description:
             type: string
           price:
             type: number
             format: float
           category:
             type: string
           imageUrl:
             type: string
             format: uri
           inStock:
             type: boolean
             default: true
           createdAt:
             type: string
             format: date-time
           updatedAt:
             type: string
             format: date-time
   EOF
   ```

### 1.4 Externalisation de la configuration

1. Créez un ConfigMap pour la configuration de l'application :
   ```bash
   cat > catalog-config.yaml << EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: catalog-config
   data:
     application.properties: |
       # Database configuration
       db.host=mongodb
       db.port=27017
       db.name=catalogdb
       db.collection=products
       
       # API configuration
       api.version=v1
       api.prefix=/api
       
       # Logging configuration
       logging.level=INFO
       logging.format=json
       
       # Feature flags
       feature.recommendations=false
       feature.reviews=true
       feature.inventory=true
   EOF
   
   oc create -f catalog-config.yaml
   ```

2. Créez un Secret pour les informations sensibles :
   ```bash
   cat > catalog-secrets.yaml << EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: catalog-secrets
   type: Opaque
   stringData:
     db.username: cataloguser
     db.password: catalogpassword
     api.key: a1b2c3d4e5f6g7h8i9j0
   EOF
   
   oc create -f catalog-secrets.yaml
   ```

## Partie 2 : Construction d'applications avec OpenShift

### 2.1 Création d'une application Node.js

1. Créez un nouveau projet :
   ```bash
   oc new-project tp2-builds-<votre-nom>
   ```

2. Créez une application Node.js simple :
   ```bash
   mkdir -p ~/nodejs-app
   cd ~/nodejs-app
   
   # Créez le fichier package.json
   cat > package.json << EOF
   {
     "name": "nodejs-sample",
     "version": "1.0.0",
     "description": "Node.js sample application",
     "main": "server.js",
     "scripts": {
       "start": "node server.js",
       "test": "echo 'Tests passed'"
     },
     "dependencies": {
       "express": "^4.17.1"
     }
   }
   EOF
   
   # Créez le fichier server.js
   cat > server.js << EOF
   const express = require('express');
   const app = express();
   const port = process.env.PORT || 8080;
   
   app.get('/', (req, res) => {
     res.send('Hello from Node.js on OpenShift!');
   });
   
   app.get('/health', (req, res) => {
     res.status(200).send('OK');
   });
   
   app.get('/api/info', (req, res) => {
     res.json({
       app: 'nodejs-sample',
       version: '1.0.0',
       environment: process.env.NODE_ENV || 'development',
       hostname: require('os').hostname()
     });
   });
   
   app.listen(port, () => {
     console.log(\`Server running on port \${port}\`);
   });
   EOF
   ```

### 2.2 Configuration du processus de build

1. Créez une BuildConfig pour l'application Node.js :
   ```bash
   cat > buildconfig.yaml << EOF
   apiVersion: build.openshift.io/v1
   kind: BuildConfig
   metadata:
     name: nodejs-sample
   spec:
     source:
       type: Binary
     strategy:
       type: Source
       sourceStrategy:
         from:
           kind: ImageStreamTag
           namespace: openshift
           name: nodejs:14-ubi8
     output:
       to:
         kind: ImageStreamTag
         name: nodejs-sample:latest
     triggers:
       - type: ConfigChange
       - type: ImageChange
     runPolicy: Serial
     postCommit:
       script: "npm test"
   EOF
   
   oc create -f buildconfig.yaml
   ```

2. Créez un ImageStream pour l'application :
   ```bash
   cat > imagestream.yaml << EOF
   apiVersion: image.openshift.io/v1
   kind: ImageStream
   metadata:
     name: nodejs-sample
   spec:
     lookupPolicy:
       local: true
   EOF
   
   oc create -f imagestream.yaml
   ```

### 2.3 Déclenchement et surveillance d'un build

1. Démarrez un build à partir des fichiers locaux :
   ```bash
   oc start-build nodejs-sample --from-dir=. --follow
   ```

2. Vérifiez le statut du build :
   ```bash
   oc get builds
   ```

3. Examinez les logs du build :
   ```bash
   oc logs -f bc/nodejs-sample
   ```

### 2.4 Déploiement de l'application

1. Créez un déploiement pour l'application :
   ```bash
   cat > deployment.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: nodejs-sample
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: nodejs-sample
     template:
       metadata:
         labels:
           app: nodejs-sample
       spec:
         containers:
         - name: nodejs-sample
           image: image-registry.openshift-image-registry.svc:5000/tp2-builds-<votre-nom>/nodejs-sample:latest
           ports:
           - containerPort: 8080
           env:
           - name: NODE_ENV
             value: production
           resources:
             limits:
               memory: 256Mi
               cpu: 200m
             requests:
               memory: 128Mi
               cpu: 100m
           readinessProbe:
             httpGet:
               path: /health
               port: 8080
             initialDelaySeconds: 5
             periodSeconds: 5
           livenessProbe:
             httpGet:
               path: /health
               port: 8080
             initialDelaySeconds: 15
             periodSeconds: 20
   EOF
   
   oc create -f deployment.yaml
   ```

2. Créez un service pour l'application :
   ```bash
   cat > service.yaml << EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: nodejs-sample
   spec:
     selector:
       app: nodejs-sample
     ports:
     - port: 80
       targetPort: 8080
   EOF
   
   oc create -f service.yaml
   ```

3. Exposez l'application via une route :
   ```bash
   oc expose service/nodejs-sample
   ```

4. Accédez à l'application :
   ```bash
   oc get route nodejs-sample
   ```

## Partie 3 : Personnalisation de versions source-to-image (S2I)

### 3.1 Exploration d'une image S2I existante

1. Créez un nouveau projet :
   ```bash
   oc new-project tp2-s2i-<votre-nom>
   ```

2. Examinez une image S2I Node.js existante :
   ```bash
   mkdir -p ~/s2i-exploration
   cd ~/s2i-exploration
   
   # Clonez le dépôt S2I Node.js
   git clone https://github.com/sclorg/s2i-nodejs-container.git
   cd s2i-nodejs-container/14
   
   # Examinez les scripts S2I
   ls -la s2i/bin/
   cat s2i/bin/assemble
   cat s2i/bin/run
   cat s2i/bin/usage
   ```

### 3.2 Création d'une image S2I personnalisée

1. Créez un répertoire pour votre image S2I personnalisée :
   ```bash
   mkdir -p ~/custom-s2i/s2i/bin
   cd ~/custom-s2i
   ```

2. Créez un Dockerfile pour l'image S2I :
   ```bash
   cat > Dockerfile << EOF
   FROM registry.access.redhat.com/ubi8/nodejs-14
   
   LABEL io.k8s.description="Custom Node.js S2I builder with additional tools"
   LABEL io.k8s.display-name="Node.js 14 Custom S2I builder"
   LABEL io.openshift.s2i.scripts-url=image:///usr/libexec/s2i
   
   # Install additional packages
   USER root
   RUN dnf install -y git wget curl && \
       dnf clean all
   
   # Copy original S2I scripts to a backup location
   RUN cp -r /usr/libexec/s2i /usr/libexec/s2i.original
   
   # Copy custom S2I scripts
   COPY ./s2i/bin/ /usr/libexec/s2i/
   
   USER 1001
   
   CMD ["/usr/libexec/s2i/usage"]
   EOF
   ```

3. Créez les scripts S2I personnalisés :
   ```bash
   # Script assemble
   cat > s2i/bin/assemble << EOF
   #!/bin/bash
   
   echo "-----> Running custom assemble script"
   
   # Run the original assemble script
   /usr/libexec/s2i.original/assemble
   
   # Add custom logic
   echo "-----> Installing additional dependencies"
   npm install --production=false
   
   # Run tests
   echo "-----> Running tests"
   npm test || exit 1
   
   echo "-----> Assemble script completed successfully"
   EOF
   
   chmod +x s2i/bin/assemble
   
   # Script run
   cat > s2i/bin/run << EOF
   #!/bin/bash
   
   echo "-----> Running custom run script"
   
   # Add custom environment setup
   export NODE_ENV=production
   
   # Run the original run script
   exec /usr/libexec/s2i.original/run
   EOF
   
   chmod +x s2i/bin/run
   
   # Script usage
   cat > s2i/bin/usage << EOF
   #!/bin/bash
   
   echo "Custom Node.js S2I builder with additional tools"
   echo "To use it, install S2I: https://github.com/openshift/source-to-image"
   echo ""
   echo "Sample invocation:"
   echo "s2i build <source code path> custom-nodejs-s2i <application image>"
   EOF
   
   chmod +x s2i/bin/usage
   ```

### 3.3 Construction et test de l'image S2I

1. Construisez l'image S2I personnalisée :
   ```bash
   oc new-build --name=custom-nodejs-s2i --binary=true
   oc start-build custom-nodejs-s2i --from-dir=. --follow
   ```

2. Créez une application de test :
   ```bash
   mkdir -p ~/test-s2i-app
   cd ~/test-s2i-app
   
   # Créez le fichier package.json
   cat > package.json << EOF
   {
     "name": "test-s2i-app",
     "version": "1.0.0",
     "description": "Test application for custom S2I",
     "main": "server.js",
     "scripts": {
       "test": "echo 'Tests passed' && exit 0",
       "start": "node server.js"
     }
   }
   EOF
   
   # Créez le fichier server.js
   cat > server.js << EOF
   const http = require('http');
   
   const server = http.createServer((req, res) => {
     res.statusCode = 200;
     res.setHeader('Content-Type', 'text/plain');
     res.end('Hello from custom S2I builder!');
   });
   
   const port = process.env.PORT || 8080;
   server.listen(port, () => {
     console.log(\`Server running on port \${port}\`);
   });
   EOF
   ```

3. Déployez l'application avec l'image S2I personnalisée :
   ```bash
   oc new-app --name=test-custom-s2i custom-nodejs-s2i~.
   oc expose service/test-custom-s2i
   ```

4. Vérifiez le déploiement :
   ```bash
   oc get pods
   oc get route test-custom-s2i
   ```

## Partie 4 : Création d'applications à partir de modèles OpenShift

### 4.1 Exploration des modèles existants

1. Créez un nouveau projet :
   ```bash
   oc new-project tp2-templates-<votre-nom>
   ```

2. Listez les modèles disponibles dans le namespace openshift :
   ```bash
   oc get templates -n openshift
   ```

3. Examinez un modèle en détail :
   ```bash
   oc get template nodejs-mongodb-example -n openshift -o yaml > template-example.yaml
   ```

### 4.2 Création d'un modèle simple

1. Créez un modèle pour une application web avec base de données :
   ```bash
   cat > simple-template.yaml << EOF
   apiVersion: template.openshift.io/v1
   kind: Template
   metadata:
     name: simple-webapp
     annotations:
       description: "Template for a simple web application with database"
       tags: "quickstart,nodejs,mongodb"
   objects:
   - apiVersion: v1
     kind: Secret
     metadata:
       name: \${DATABASE_SERVICE_NAME}
     stringData:
       database-user: \${DATABASE_USER}
       database-password: \${DATABASE_PASSWORD}
       database-admin-password: \${DATABASE_ADMIN_PASSWORD}
   - apiVersion: v1
     kind: Service
     metadata:
       name: \${DATABASE_SERVICE_NAME}
     spec:
       ports:
       - name: mongodb
         port: 27017
       selector:
         name: \${DATABASE_SERVICE_NAME}
   - apiVersion: apps/v1
     kind: Deployment
     metadata:
       name: \${DATABASE_SERVICE_NAME}
     spec:
       replicas: 1
       selector:
         matchLabels:
           name: \${DATABASE_SERVICE_NAME}
       template:
         metadata:
           labels:
             name: \${DATABASE_SERVICE_NAME}
         spec:
           containers:
           - name: mongodb
             image: mongodb:3.6
             ports:
             - containerPort: 27017
             env:
             - name: MONGODB_USER
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-user
             - name: MONGODB_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-password
             - name: MONGODB_ADMIN_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-admin-password
             - name: MONGODB_DATABASE
               value: \${DATABASE_NAME}
   - apiVersion: v1
     kind: Service
     metadata:
       name: \${NAME}
     spec:
       ports:
       - name: web
         port: 8080
       selector:
         name: \${NAME}
   - apiVersion: route.openshift.io/v1
     kind: Route
     metadata:
       name: \${NAME}
     spec:
       host: \${APPLICATION_DOMAIN}
       to:
         kind: Service
         name: \${NAME}
   - apiVersion: apps/v1
     kind: Deployment
     metadata:
       name: \${NAME}
     spec:
       replicas: \${REPLICAS}
       selector:
         matchLabels:
           name: \${NAME}
       template:
         metadata:
           labels:
             name: \${NAME}
         spec:
           containers:
           - name: nodejs
             image: nodejs:14
             ports:
             - containerPort: 8080
             env:
             - name: DATABASE_SERVICE_NAME
               value: \${DATABASE_SERVICE_NAME}
             - name: MONGODB_USER
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-user
             - name: MONGODB_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-password
             - name: MONGODB_DATABASE
               value: \${DATABASE_NAME}
             - name: MONGODB_ADMIN_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-admin-password
   parameters:
   - name: NAME
     displayName: Name
     description: The name assigned to all objects and the frontend service.
     required: true
     value: nodejs-app
   - name: DATABASE_SERVICE_NAME
     displayName: Database Service Name
     description: The name of the MongoDB service.
     required: true
     value: mongodb
   - name: DATABASE_USER
     displayName: MongoDB Username
     description: Username for MongoDB user.
     required: true
     value: user
   - name: DATABASE_PASSWORD
     displayName: MongoDB Password
     description: Password for the MongoDB user.
     generate: expression
     from: "[a-zA-Z0-9]{16}"
   - name: DATABASE_ADMIN_PASSWORD
     displayName: MongoDB Admin Password
     description: Password for the MongoDB admin user.
     generate: expression
     from: "[a-zA-Z0-9]{16}"
   - name: DATABASE_NAME
     displayName: Database Name
     description: Name of the MongoDB database.
     required: true
     value: sampledb
   - name: APPLICATION_DOMAIN
     displayName: Application Hostname
     description: The exposed hostname for the application.
     value: ""
   - name: REPLICAS
     displayName: Number of replicas
     description: Number of replicas for the web application.
     required: true
     value: "1"
   EOF
   
   oc create -f simple-template.yaml
   ```

### 4.3 Déploiement à partir du modèle

1. Déployez une application à partir du modèle :
   ```bash
   oc new-app --template=simple-webapp \
     -p NAME=my-webapp \
     -p DATABASE_SERVICE_NAME=my-mongodb \
     -p DATABASE_USER=myuser \
     -p DATABASE_NAME=mydb \
     -p REPLICAS=2
   ```

2. Vérifiez les ressources créées :
   ```bash
   oc get all
   oc get secrets
   ```

### 4.4 Personnalisation du modèle

1. Modifiez le modèle pour ajouter des fonctionnalités :
   ```bash
   cat > updated-template.yaml << EOF
   apiVersion: template.openshift.io/v1
   kind: Template
   metadata:
     name: simple-webapp-v2
     annotations:
       description: "Template for a simple web application with database (v2)"
       tags: "quickstart,nodejs,mongodb"
   # ... [contenu précédent] ...
   # Ajoutez un ConfigMap pour la configuration
   - apiVersion: v1
     kind: ConfigMap
     metadata:
       name: \${NAME}-config
     data:
       app.properties: |
         environment=\${ENVIRONMENT}
         logging.level=\${LOGGING_LEVEL}
   # ... [reste du contenu] ...
   parameters:
   # ... [paramètres précédents] ...
   - name: ENVIRONMENT
     displayName: Environment
     description: Environment (dev, test, prod)
     required: true
     value: dev
   - name: LOGGING_LEVEL
     displayName: Logging Level
     description: Logging level (INFO, DEBUG, WARN, ERROR)
     required: true
     value: INFO
   EOF
   
   # Créez le modèle mis à jour
   oc create -f updated-template.yaml
   ```

2. Déployez une application avec le modèle mis à jour :
   ```bash
   oc new-app --template=simple-webapp-v2 \
     -p NAME=my-webapp-v2 \
     -p DATABASE_SERVICE_NAME=my-mongodb-v2 \
     -p DATABASE_USER=myuser \
     -p DATABASE_NAME=mydb \
     -p REPLICAS=2 \
     -p ENVIRONMENT=test \
     -p LOGGING_LEVEL=DEBUG
   ```

## Partie 5 : Nettoyage et conclusion

1. Listez tous les projets créés :
   ```bash
   oc get projects | grep tp2
   ```

2. Nettoyez les ressources (optionnel) :
   ```bash
   oc delete project tp2-cloud-native-<votre-nom>
   oc delete project tp2-builds-<votre-nom>
   oc delete project tp2-s2i-<votre-nom>
   oc delete project tp2-templates-<votre-nom>
   ```

## Questions de réflexion

1. Comment les principes de conception cloud-native influencent-ils la façon dont vous structurez vos applications pour OpenShift ?
2. Quels sont les avantages et inconvénients des différentes stratégies de build dans OpenShift ?
3. Dans quels cas la personnalisation d'images S2I est-elle particulièrement utile ?
4. Comment les modèles OpenShift peuvent-ils améliorer la productivité et la standardisation dans une équipe de développement ?

## Ressources supplémentaires

- [Guide des 12 facteurs pour les applications cloud-native](https://12factor.net/fr/)
- [Documentation S2I](https://github.com/openshift/source-to-image)
- [Bonnes pratiques pour les modèles OpenShift](https://docs.openshift.com/container-platform/4.10/openshift_images/using-templates.html)
- [Patterns de microservices](https://microservices.io/patterns/index.html)
