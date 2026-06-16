pipeline {
  agent none

  options {
    timestamps()
    skipDefaultCheckout(true)
  }

  environment {
    CI = 'true'
    DATABASE_URL = 'postgresql://ci:ci@localhost:5432/blockhost_ci?schema=public'
    VITE_API_BASE_URL = 'http://localhost:4000'
    VITE_FIREBASE_API_KEY = 'ci-placeholder'
    VITE_FIREBASE_AUTH_DOMAIN = 'ci-placeholder.firebaseapp.com'
    VITE_FIREBASE_PROJECT_ID = 'ci-placeholder'
    VITE_FIREBASE_STORAGE_BUCKET = 'ci-placeholder.appspot.com'
    VITE_FIREBASE_MESSAGING_SENDER_ID = '000000000000'
    VITE_FIREBASE_APP_ID = '1:000000000000:web:ci'
  }

  stages {
    stage('Checkout') {
      agent any
      steps {
        checkout scm
      }
    }

    stage('Backend install') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('backend') {
          sh 'npm ci'
        }
      }
    }

    stage('Backend Prisma generate') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('backend') {
          sh 'npm run prisma:generate'
        }
      }
    }

    stage('Backend tests') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('backend') {
          sh 'npm test'
        }
      }
    }

    stage('Backend typecheck') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('backend') {
          sh 'npm run typecheck'
        }
      }
    }

    stage('Backend build') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('backend') {
          sh 'npm run build'
        }
      }
    }

    stage('Frontend install') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('frontend') {
          sh 'npm ci'
        }
      }
    }

    stage('Frontend typecheck') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('frontend') {
          sh 'npm run typecheck'
        }
      }
    }

    stage('Frontend build') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root'
          reuseNode true
        }
      }
      steps {
        dir('frontend') {
          sh 'npm run build'
        }
      }
    }
  }
}
