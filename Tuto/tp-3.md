# TP Jour 3 : Déploiement avancé et migration d'applications OpenShift

## Objectifs du TP
- Maîtriser la création et le déploiement de modèles multi-conteneurs complexes
- Configurer et gérer différentes stratégies de déploiement
- Mettre en place le monitoring des applications
- Intégrer des services externes et migrer des applications existantes vers OpenShift

## Prérequis
- Accès à un cluster OpenShift
- Outil CLI `oc` installé
- Avoir complété les TP des Jours 1 et 2

## Durée estimée
3 heures

## Partie 1 : Création avancée d'applications à partir de modèles OpenShift

### 1.1 Création d'un modèle multi-conteneurs complet

1. Créez un nouveau projet :
   ```bash
   oc new-project tp3-templates-<votre-nom>
   ```

2. Créez un modèle pour une application à trois tiers (frontend, backend, base de données) :
   ```bash
   cat > three-tier-template.yaml << EOF
   apiVersion: template.openshift.io/v1
   kind: Template
   metadata:
     name: three-tier-app
     annotations:
       description: "Template for a three-tier application (frontend, backend, database)"
       tags: "quickstart,nodejs,java,postgresql"
   objects:
   # Secret pour la base de données
   - apiVersion: v1
     kind: Secret
     metadata:
       name: \${DATABASE_SERVICE_NAME}
     stringData:
       database-user: \${DATABASE_USER}
       database-password: \${DATABASE_PASSWORD}
       database-admin-password: \${DATABASE_ADMIN_PASSWORD}
   
   # Service et déploiement pour la base de données
   - apiVersion: v1
     kind: Service
     metadata:
       name: \${DATABASE_SERVICE_NAME}
     spec:
       ports:
       - name: postgresql
         port: 5432
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
           - name: postgresql
             image: postgres:13
             ports:
             - containerPort: 5432
             env:
             - name: POSTGRES_USER
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-user
             - name: POSTGRES_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-password
             - name: POSTGRES_DB
               value: \${DATABASE_NAME}
             volumeMounts:
             - name: postgresql-data
               mountPath: /var/lib/postgresql/data
           volumes:
           - name: postgresql-data
             emptyDir: {}
   
   # Service et déploiement pour le backend
   - apiVersion: v1
     kind: Service
     metadata:
       name: \${BACKEND_SERVICE_NAME}
     spec:
       ports:
       - name: http
         port: 8080
       selector:
         name: \${BACKEND_SERVICE_NAME}
   - apiVersion: apps/v1
     kind: Deployment
     metadata:
       name: \${BACKEND_SERVICE_NAME}
     spec:
       replicas: \${{BACKEND_REPLICAS}}
       selector:
         matchLabels:
           name: \${BACKEND_SERVICE_NAME}
       template:
         metadata:
           labels:
             name: \${BACKEND_SERVICE_NAME}
         spec:
           containers:
           - name: backend
             image: \${BACKEND_IMAGE}
             ports:
             - containerPort: 8080
             env:
             - name: DATABASE_SERVICE_NAME
               value: \${DATABASE_SERVICE_NAME}
             - name: DATABASE_USER
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-user
             - name: DATABASE_PASSWORD
               valueFrom:
                 secretKeyRef:
                   name: \${DATABASE_SERVICE_NAME}
                   key: database-password
             - name: DATABASE_NAME
               value: \${DATABASE_NAME}
             - name: DATABASE_PORT
               value: "5432"
             resources:
               limits:
                 memory: \${BACKEND_MEMORY_LIMIT}
                 cpu: \${BACKEND_CPU_LIMIT}
               requests:
                 memory: \${BACKEND_MEMORY_REQUEST}
                 cpu: \${BACKEND_CPU_REQUEST}
             readinessProbe:
               httpGet:
                 path: /health
                 port: 8080
               initialDelaySeconds: 15
               timeoutSeconds: 1
             livenessProbe:
               httpGet:
                 path: /health
                 port: 8080
               initialDelaySeconds: 30
               timeoutSeconds: 1
               periodSeconds: 10
               successThreshold: 1
               failureThreshold: 3
   
   # Service, route et déploiement pour le frontend
   - apiVersion: v1
     kind: Service
     metadata:
       name: \${FRONTEND_SERVICE_NAME}
     spec:
       ports:
       - name: http
         port: 8080
       selector:
         name: \${FRONTEND_SERVICE_NAME}
   - apiVersion: route.openshift.io/v1
     kind: Route
     metadata:
       name: \${FRONTEND_SERVICE_NAME}
     spec:
       host: \${APPLICATION_DOMAIN}
       to:
         kind: Service
         name: \${FRONTEND_SERVICE_NAME}
   - apiVersion: apps/v1
     kind: Deployment
     metadata:
       name: \${FRONTEND_SERVICE_NAME}
     spec:
       replicas: \${FRONTEND_REPLICAS}
       selector:
         matchLabels:
           name: \${FRONTEND_SERVICE_NAME}
       template:
         metadata:
           labels:
             name: \${FRONTEND_SERVICE_NAME}
         spec:
           containers:
           - name: frontend
             image: \${FRONTEND_IMAGE}
             ports:
             - containerPort: 8080
             env:
             - name: BACKEND_URL
               value: http://\${BACKEND_SERVICE_NAME}:8080
             resources:
               limits:
                 memory: \${FRONTEND_MEMORY_LIMIT}
                 cpu: \${FRONTEND_CPU_LIMIT}
               requests:
                 memory: \${FRONTEND_MEMORY_REQUEST}
                 cpu: \${FRONTEND_CPU_REQUEST}
             readinessProbe:
               httpGet:
                 path: /
                 port: 8080
               initialDelaySeconds: 10
               timeoutSeconds: 1
             livenessProbe:
               httpGet:
                 path: /
                 port: 8080
               initialDelaySeconds: 30
               timeoutSeconds: 1
               periodSeconds: 10
               successThreshold: 1
               failureThreshold: 3
   
   # ConfigMap pour la configuration de l'application
   - apiVersion: v1
     kind: ConfigMap
     metadata:
       name: \${APP_CONFIG_MAP}
     data:
       app.properties: |
         environment=\${ENVIRONMENT}
         logging.level=\${LOGGING_LEVEL}
         feature.experimental=\${ENABLE_EXPERIMENTAL_FEATURES}
   
   parameters:
   # Paramètres généraux
   - name: ENVIRONMENT
     displayName: Environment
     description: Environment (dev, test, prod)
     required: true
     value: dev
   - name: APPLICATION_DOMAIN
     displayName: Application Domain
     description: The exposed hostname for the application
     value: ""
   - name: APP_CONFIG_MAP
     displayName: Application ConfigMap
     description: Name of the ConfigMap for application configuration
     required: true
     value: app-config
   
   # Paramètres de base de données
   - name: DATABASE_SERVICE_NAME
     displayName: Database Service Name
     description: The name of the PostgreSQL service
     required: true
     value: postgresql
   - name: DATABASE_USER
     displayName: PostgreSQL Username
     description: Username for PostgreSQL user
     required: true
     value: dbuser
   - name: DATABASE_PASSWORD
     displayName: PostgreSQL Password
     description: Password for the PostgreSQL user
     generate: expression
     from: "[a-zA-Z0-9]{16}"
   - name: DATABASE_ADMIN_PASSWORD
     displayName: PostgreSQL Admin Password
     description: Password for the PostgreSQL admin user
     generate: expression
     from: "[a-zA-Z0-9]{16}"
   - name: DATABASE_NAME
     displayName: Database Name
     description: Name of the PostgreSQL database
     required: true
     value: appdb
   
   # Paramètres du backend
   - name: BACKEND_SERVICE_NAME
     displayName: Backend Service Name
     description: Name of the backend service
     required: true
     value: backend
   - name: BACKEND_IMAGE
     displayName: Backend Image
     description: Backend Docker image to use
     required: true
     value: quay.io/redhattraining/do240-backend:latest
   - name: BACKEND_REPLICAS
     displayName: Backend Replicas
     description: Number of backend replicas
     required: true
     value: "2"
   - name: BACKEND_MEMORY_LIMIT
     displayName: Backend Memory Limit
     description: Maximum amount of memory the backend container can use
     required: true
     value: 512Mi
   - name: BACKEND_CPU_LIMIT
     displayName: Backend CPU Limit
     description: Maximum amount of CPU the backend container can use
     required: true
     value: 500m
   - name: BACKEND_MEMORY_REQUEST
     displayName: Backend Memory Request
     description: Requested amount of memory for the backend container
     required: true
     value: 256Mi
   - name: BACKEND_CPU_REQUEST
     displayName: Backend CPU Request
     description: Requested amount of CPU for the backend container
     required: true
     value: 200m
   
   # Paramètres du frontend
   - name: FRONTEND_SERVICE_NAME
     displayName: Frontend Service Name
     description: Name of the frontend service
     required: true
     value: frontend
   - name: FRONTEND_IMAGE
     displayName: Frontend Image
     description: Frontend Docker image to use
     required: true
     value: quay.io/redhattraining/do240-frontend:latest
   - name: FRONTEND_REPLICAS
     displayName: Frontend Replicas
     description: Number of frontend replicas
     required: true
     value: "2"
   - name: FRONTEND_MEMORY_LIMIT
     displayName: Frontend Memory Limit
     description: Maximum amount of memory the frontend container can use
     required: true
     value: 256Mi
   - name: FRONTEND_CPU_LIMIT
     displayName: Frontend CPU Limit
     description: Maximum amount of CPU the frontend container can use
     required: true
     value: 300m
   - name: FRONTEND_MEMORY_REQUEST
     displayName: Frontend Memory Request
     description: Requested amount of memory for the frontend container
     required: true
     value: 128Mi
   - name: FRONTEND_CPU_REQUEST
     displayName: Frontend CPU Request
     description: Requested amount of CPU for the frontend container
     required: true
     value: 100m
   
   # Paramètres de configuration
   - name: LOGGING_LEVEL
     displayName: Logging Level
     description: Logging level (INFO, DEBUG, WARN, ERROR)
     required: true
     value: INFO
   - name: ENABLE_EXPERIMENTAL_FEATURES
     displayName: Enable Experimental Features
     description: Enable experimental features (true/false)
     required: true
     value: "false"
   EOF
   
   oc create -f three-tier-template.yaml
   ```

### 1.2 Déploiement à partir du modèle complexe

1. Déployez une application à partir du modèle :
   ```bash
   oc new-app --template=three-tier-app \
     -p ENVIRONMENT=dev \
     -p BACKEND_REPLICAS=1 \
     -p FRONTEND_REPLICAS=1 \
     -p LOGGING_LEVEL=DEBUG
   ```

2. Vérifiez les ressources créées :
   ```bash
   oc get all
   oc get configmap
   oc get secret
   ```

### 1.3 Paramétrage pour différents environnements

1. Créez un fichier de paramètres pour l'environnement de production :
   ```bash
   cat > production-params.env << EOF
   ENVIRONMENT=production
   BACKEND_REPLICAS=3
   FRONTEND_REPLICAS=3
   BACKEND_MEMORY_LIMIT=1Gi
   BACKEND_CPU_LIMIT=1000m
   FRONTEND_MEMORY_LIMIT=512Mi
   FRONTEND_CPU_LIMIT=500m
   LOGGING_LEVEL=WARN
   ENABLE_EXPERIMENTAL_FEATURES=false
   EOF
   ```

2. Déployez une version de production dans un nouveau projet :
   ```bash
   oc new-project tp3-templates-prod-<votre-nom>
   oc new-app --template=three-tier-app --param-file=production-params.env
   ```

## Partie 2 : Gestion de déploiement d'applications

### 2.1 Configuration des sondes de disponibilité

1. Créez un nouveau projet :
   ```bash
   oc new-project tp3-deployment-<votre-nom>
   ```

2. Déployez une application avec des sondes de disponibilité :
   ```bash
   cat > deployment-probes.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: app-with-probes
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: app-with-probes
     template:
       metadata:
         labels:
           app: app-with-probes
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/hello-world-nginx:v1.0
           ports:
           - containerPort: 8080
           readinessProbe:
             httpGet:
               path: /
               port: 8080
             initialDelaySeconds: 5
             periodSeconds: 5
             timeoutSeconds: 1
             successThreshold: 1
             failureThreshold: 3
           livenessProbe:
             httpGet:
               path: /
               port: 8080
             initialDelaySeconds: 15
             periodSeconds: 20
             timeoutSeconds: 1
             successThreshold: 1
             failureThreshold: 3
           startupProbe:
             httpGet:
               path: /
               port: 8080
             initialDelaySeconds: 5
             periodSeconds: 5
             timeoutSeconds: 1
             successThreshold: 1
             failureThreshold: 30
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: app-with-probes
   spec:
     selector:
       app: app-with-probes
     ports:
     - port: 80
       targetPort: 8080
   ---
   apiVersion: route.openshift.io/v1
   kind: Route
   metadata:
     name: app-with-probes
   spec:
     to:
       kind: Service
       name: app-with-probes
   EOF
   
   oc create -f deployment-probes.yaml
   ```

3. Vérifiez l'état des pods et des sondes :
   ```bash
   oc get pods
   oc describe pod $(oc get pods -l app=app-with-probes -o name | head -1)
   ```

### 2.2 Mise en place d'une stratégie de déploiement Rolling

1. Créez un déploiement avec stratégie Rolling :
   ```bash
   cat > rolling-deployment.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: rolling-app
   spec:
     replicas: 5
     strategy:
       type: RollingUpdate
       rollingUpdate:
         maxSurge: 1
         maxUnavailable: 1
     selector:
       matchLabels:
         app: rolling-app
     template:
       metadata:
         labels:
           app: rolling-app
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/hello-world-nginx:v1.0
           ports:
           - containerPort: 8080
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: rolling-app
   spec:
     selector:
       app: rolling-app
     ports:
     - port: 80
       targetPort: 8080
   ---
   apiVersion: route.openshift.io/v1
   kind: Route
   metadata:
     name: rolling-app
   spec:
     to:
       kind: Service
       name: rolling-app
   EOF
   
   oc create -f rolling-deployment.yaml
   ```

2. Effectuez une mise à jour de l'application :
   ```bash
   oc set image deployment/rolling-app app=quay.io/redhattraining/hello-world-nginx:v2.0
   ```

3. Observez le processus de déploiement :
   ```bash
   oc rollout status deployment/rolling-app
   ```

### 2.3 Mise en œuvre d'un déploiement Blue-Green

1. Déployez la version "blue" :
   ```bash
   cat > blue-deployment.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: app-blue
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: app-blue
     template:
       metadata:
         labels:
           app: app-blue
           version: blue
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/hello-world-nginx:v1.0
           ports:
           - containerPort: 8080
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: app-blue
   spec:
     selector:
       app: app-blue
     ports:
     - port: 80
       targetPort: 8080
   EOF
   
   oc create -f blue-deployment.yaml
   ```

2. Créez une route pointant vers la version "blue" :
   ```bash
   cat > app-route.yaml << EOF
   apiVersion: route.openshift.io/v1
   kind: Route
   metadata:
     name: app
   spec:
     to:
       kind: Service
       name: app-blue
   EOF
   
   oc create -f app-route.yaml
   ```

3. Déployez la version "green" :
   ```bash
   cat > green-deployment.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: app-green
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: app-green
     template:
       metadata:
         labels:
           app: app-green
           version: green
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/hello-world-nginx:v2.0
           ports:
           - containerPort: 8080
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: app-green
   spec:
     selector:
       app: app-green
     ports:
     - port: 80
       targetPort: 8080
   EOF
   
   oc create -f green-deployment.yaml
   ```

4. Basculez le trafic vers la version "green" :
   ```bash
   oc patch route/app -p '{"spec":{"to":{"name":"app-green"}}}'
   ```

5. Vérifiez que la route pointe maintenant vers la version "green" :
   ```bash
   oc describe route app
   ```

### 2.4 Configuration du monitoring

1. Explorez les métriques disponibles dans la console web OpenShift :
   - Accédez à la console web OpenShift
   - Naviguez vers Monitoring > Dashboards
   - Explorez les tableaux de bord disponibles

2. Simulez une charge sur l'application :
   ```bash
   # Obtenez l'URL de la route
   ROUTE_URL=$(oc get route app -o jsonpath='{.spec.host}')
   
   # Générez du trafic
   for i in {1..100}; do curl -s http://$ROUTE_URL > /dev/null; sleep 0.1; done
   ```

3. Observez les métriques dans le tableau de bord

## Partie 3 : Migration d'applications vers OpenShift

### 3.1 Intégration d'un service externe via Service ExternalName

1. Créez un nouveau projet :
   ```bash
   oc new-project tp3-external-services-<votre-nom>
   ```

2. Créez un service ExternalName pointant vers un service externe :
   ```bash
   cat > external-name-service.yaml << EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: external-db
   spec:
     type: ExternalName
     externalName: my-database.example.com
     ports:
     - port: 5432
   EOF
   
   oc create -f external-name-service.yaml
   ```

3. Créez un secret pour les informations d'authentification :
   ```bash
   cat > db-credentials.yaml << EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: db-credentials
   type: Opaque
   stringData:
     username: dbuser
     password: dbpassword
   EOF
   
   oc create -f db-credentials.yaml
   ```

4. Déployez une application qui utilise ce service externe :
   ```bash
   cat > app-with-external-db.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: app-with-external-db
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: app-with-external-db
     template:
       metadata:
         labels:
           app: app-with-external-db
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/do240-postgres-sample:v1.0
           env:
           - name: DB_HOST
             value: external-db
           - name: DB_PORT
             value: "5432"
           - name: DB_NAME
             value: mydb
           - name: DB_USER
             valueFrom:
               secretKeyRef:
                 name: db-credentials
                 key: username
           - name: DB_PASSWORD
             valueFrom:
               secretKeyRef:
                 name: db-credentials
                 key: password
   EOF
   
   oc create -f app-with-external-db.yaml
   ```

### 3.2 Intégration d'un service externe via Service avec Endpoints

1. Créez un service et des endpoints pour un service externe :
   ```bash
   cat > service-with-endpoints.yaml << EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: external-api
   spec:
     ports:
     - port: 80
       targetPort: 80
   ---
   apiVersion: v1
   kind: Endpoints
   metadata:
     name: external-api
   subsets:
   - addresses:
     - ip: 192.168.1.1  # Remplacez par une IP réelle
     ports:
     - port: 80
   EOF
   
   oc create -f service-with-endpoints.yaml
   ```

2. Déployez une application qui utilise ce service :
   ```bash
   cat > app-with-external-api.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: app-with-external-api
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: app-with-external-api
     template:
       metadata:
         labels:
           app: app-with-external-api
       spec:
         containers:
         - name: app
           image: quay.io/redhattraining/do240-api-consumer:v1.0
           env:
           - name: API_URL
             value: http://external-api
   EOF
   
   oc create -f app-with-external-api.yaml
   ```

### 3.3 Migration d'une application JBoss/Wildfly

1. Créez un nouveau projet :
   ```bash
   oc new-project tp3-jboss-migration-<votre-nom>
   ```

2. Créez un secret pour les informations d'authentification de la base de données :
   ```bash
   cat > jboss-db-secret.yaml << EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: jboss-db-secret
   type: Opaque
   stringData:
     username: jbossuser
     password: jbosspassword
   EOF
   
   oc create -f jboss-db-secret.yaml
   ```

3. Créez un ConfigMap pour la configuration JBoss :
   ```bash
   cat > jboss-config.yaml << EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: jboss-config
   data:
     standalone-openshift.xml: |
       <?xml version="1.0" ?>
       <server xmlns="urn:jboss:domain:13.0">
         <!-- Configuration JBoss simplifiée pour l'exemple -->
         <!-- Dans un cas réel, vous auriez une configuration complète -->
       </server>
   EOF
   
   oc create -f jboss-config.yaml
   ```

4. Déployez une application JBoss EAP :
   ```bash
   cat > jboss-app.yaml << EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: jboss-app
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: jboss-app
     template:
       metadata:
         labels:
           app: jboss-app
       spec:
         containers:
         - name: jboss
           image: registry.access.redhat.com/jboss-eap-7/eap74-openjdk11-openshift-rhel8:latest
           ports:
           - containerPort: 8080
           - containerPort: 8443
           env:
           - name: DB_SERVICE_PREFIX_MAPPING
             value: jboss-postgresql=DB
           - name: DB_JNDI
             value: java:jboss/datasources/PostgreSQLDS
           - name: DB_USERNAME
             valueFrom:
               secretKeyRef:
                 name: jboss-db-secret
                 key: username
           - name: DB_PASSWORD
             valueFrom:
               secretKeyRef:
                 name: jboss-db-secret
                 key: password
           - name: DB_DATABASE
             value: jbossdb
           - name: DB_MIN_POOL_SIZE
             value: "10"
           - name: DB_MAX_POOL_SIZE
             value: "50"
           - name: DB_TX_ISOLATION
             value: TRANSACTION_READ_COMMITTED
           volumeMounts:
           - name: config-volume
             mountPath: /opt/eap/standalone/configuration/standalone-openshift.xml
             subPath: standalone-openshift.xml
         volumes:
         - name: config-volume
           configMap:
             name: jboss-config
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: jboss-app
   spec:
     selector:
       app: jboss-app
     ports:
     - name: http
       port: 8080
       targetPort: 8080
     - name: https
       port: 8443
       targetPort: 8443
   ---
   apiVersion: route.openshift.io/v1
   kind: Route
   metadata:
     name: jboss-app
   spec:
     to:
       kind: Service
       name: jboss-app
     port:
       targetPort: http
   EOF
   
   oc create -f jboss-app.yaml
   ```

### 3.4 Optimisation de l'application migrée

1. Ajoutez des sondes de disponibilité :
   ```bash
   oc patch deployment/jboss-app --type=json -p '[{"op":"add", "path":"/spec/template/spec/containers/0/readinessProbe", "value":{"httpGet":{"path":"/health","port":8080},"initialDelaySeconds":30,"timeoutSeconds":1}}]'
   
   oc patch deployment/jboss-app --type=json -p '[{"op":"add", "path":"/spec/template/spec/containers/0/livenessProbe", "value":{"httpGet":{"path":"/health","port":8080},"initialDelaySeconds":60,"timeoutSeconds":1,"periodSeconds":10}}]'
   ```

2. Configurez des limites de ressources :
   ```bash
   oc set resources deployment/jboss-app --limits=cpu=1,memory=1Gi --requests=cpu=500m,memory=512Mi
   ```

3. Configurez l'autoscaling :
   ```bash
   oc autoscale deployment/jboss-app --min=1 --max=3 --cpu-percent=80
   ```

4. Documentez le processus de migration :
   ```bash
   cat > migration-documentation.md << EOF
   # Documentation de migration JBoss vers OpenShift
   
   ## Étapes réalisées
   1. Création d'un déploiement pour l'application JBoss
   2. Configuration de la connexion à la base de données
   3. Externalisation de la configuration via ConfigMap
   4. Ajout de sondes de disponibilité
   5. Configuration des limites de ressources
   6. Mise en place de l'autoscaling
   
   ## Considérations pour la production
   - Sécuriser les communications avec TLS
   - Mettre en place une stratégie de sauvegarde
   - Configurer le monitoring et les alertes
   - Planifier les mises à jour et la maintenance
   EOF
   ```

## Partie 4 : Synthèse et bonnes pratiques

### 4.1 Création d'une checklist de préparation à la production

1. Créez un document listant les points à vérifier avant la mise en production :
   ```bash
   cat > production-checklist.md << EOF
   # Checklist de préparation à la production
   
   ## Sécurité
   - [ ] Images de conteneurs scannées pour les vulnérabilités
   - [ ] Utilisateurs non-root dans les conteneurs
   - [ ] Secrets correctement gérés
   - [ ] Network Policies configurées
   - [ ] TLS activé pour les routes exposées
   
   ## Performance et disponibilité
   - [ ] Limites de ressources configurées
   - [ ] Sondes de disponibilité configurées
   - [ ] Stratégie de déploiement adaptée
   - [ ] Autoscaling configuré
   - [ ] Affinité/anti-affinité des pods configurée
   
   ## Monitoring et observabilité
   - [ ] Métriques exposées
   - [ ] Tableaux de bord configurés
   - [ ] Alertes configurées
   - [ ] Centralisation des logs
   - [ ] Traçage distribué configuré
   
   ## Sauvegarde et reprise d'activité
   - [ ] Stratégie de sauvegarde définie
   - [ ] Procédure de restauration testée
   - [ ] Plan de reprise d'activité documenté
   - [ ] RTO et RPO définis
   
   ## Documentation
   - [ ] Architecture documentée
   - [ ] Procédures opérationnelles documentées
   - [ ] Runbooks pour les incidents courants
   - [ ] Contacts d'urgence définis
   EOF
   ```

### 4.2 Planification de la capacité

1. Créez un document de planification de la capacité :
   ```bash
   cat > capacity-planning.md << EOF
   # Planification de la capacité
   
   ## Estimation des ressources
   - CPU : 
     - Charge de base : 4 cores
     - Pics de charge : 8 cores
     - Marge de sécurité : 2 cores
   - Mémoire :
     - Charge de base : 8 GB
     - Pics de charge : 16 GB
     - Marge de sécurité : 4 GB
   - Stockage :
     - Données applicatives : 50 GB
     - Logs et métriques : 20 GB
     - Croissance estimée : 10% par mois
   
   ## Stratégie de scaling
   - Horizontal : Augmentation du nombre de pods
     - Métriques de déclenchement : CPU > 70%, Mémoire > 80%
     - Limites : Min 2 pods, Max 10 pods
   - Vertical : Augmentation des ressources par pod
     - Quand : Pour les applications avec état ou qui ne peuvent pas être facilement répliquées
   - Cluster : Ajout de nœuds
     - Déclencheurs : Utilisation globale > 80%, Échecs de scheduling
   
   ## Planification des coûts
   - Coût actuel : 1000 $ par mois
   - Coût projeté à 6 mois : 1500 $ par mois
   - Coût projeté à 12 mois : 2000 $ par mois
   - Optimisations possibles : 
     - Utilisation d'instances spot pour les workloads non critiques
     - Scaling automatique basé sur l'heure de la journée
     - Optimisation des images de conteneurs
   EOF
   ```

## Partie 5 : Nettoyage et conclusion

1. Listez tous les projets créés :
   ```bash
   oc get projects | grep tp3
   ```

2. Nettoyez les ressources (optionnel) :
   ```bash
   oc delete project tp3-templates-<votre-nom>
   oc delete project tp3-templates-prod-<votre-nom>
   oc delete project tp3-deployment-<votre-nom>
   oc delete project tp3-external-services-<votre-nom>
   oc delete project tp3-jboss-migration-<votre-nom>
   ```

## Questions de réflexion

1. Comment les modèles multi-conteneurs facilitent-ils le déploiement d'applications complexes dans OpenShift ?
2. Quels critères prenez-vous en compte pour choisir entre les différentes stratégies de déploiement (Rolling, Recreate, Blue-Green, Canary) ?
3. Quels sont les défis spécifiques à la migration d'applications traditionnelles vers OpenShift et comment les surmonter ?
4. Comment adapteriez-vous les bonnes pratiques vues dans ce TP à un environnement de production réel ?

## Ressources supplémentaires

- [Stratégies de déploiement dans OpenShift](https://docs.openshift.com/container-platform/4.10/applications/deployments/deployment-strategies.html)
- [Guide de migration vers OpenShift](https://access.redhat.com/documentation/en-us/migration_toolkit_for_applications/5.3)
- [Bonnes pratiques pour la production](https://cloud.redhat.com/blog/9-best-practices-for-deploying-highly-available-applications-to-openshift)
- [Monitoring dans OpenShift](https://docs.openshift.com/container-platform/4.10/monitoring/monitoring-overview.html)
