# CI Setup

BlockHost uses Jenkins for CI validation only. Jenkins should run tests,
typechecks, and builds for the monorepo, but it should not deploy to Render,
Firebase, Neon, or Cloudflare R2 yet.

## Oracle VM Checklist

Create the CI host:

- Create an Oracle Cloud Free Tier Ubuntu VM.
- Use an Always Free VM shape if available.
- Allocate enough boot volume space for Jenkins workspaces and Docker images.
  For this MVP, start with more disk than the default minimum if possible.
- Open only the minimum required network access.
- Keep SSH open only to trusted IPs if possible.
- Avoid exposing Jenkins directly to the public internet.
- Prefer an SSH tunnel or Cloudflare Tunnel for Jenkins access.
- Set Oracle budget alerts if the account is upgraded or pay-as-you-go.
- Back up Jenkins configuration because Always Free resources can be disrupted
  or reclaimed if they are idle.

Install Docker and Docker Compose:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
```

Install Docker Engine and the Docker Compose plugin using Docker's official
Ubuntu instructions, then verify:

```sh
docker --version
docker compose version
```

## Run Jenkins In Docker

Create a persistent Jenkins home volume:

```sh
docker volume create jenkins_home
```

Basic Jenkins container:

```sh
docker run -d \
  --name jenkins \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts
```

The root `Jenkinsfile` currently uses Docker-based Node 20 agents. If Jenkins is
running inside Docker and you want to run that Jenkinsfile as-is, Jenkins needs
access to the host Docker daemon:

```sh
docker run -d \
  --name jenkins \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts
```

Mounting `/var/run/docker.sock` gives Jenkins powerful host-level access. Treat
it like root access to the VM. Only use it on a dedicated CI VM, keep Jenkins
locked down, and do not run untrusted jobs there.

Optional Docker Compose example:

```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      # Required only for Docker-agent pipelines like the current Jenkinsfile.
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  jenkins_home:
```

If you do not want to mount the Docker socket, use a Jenkins agent image or VM
with Node 20 installed and adjust the pipeline away from Docker agents.

## First-Time Jenkins Setup

Retrieve the initial admin password:

```sh
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open Jenkins through your protected access path, such as an SSH tunnel:

```sh
ssh -L 8080:localhost:8080 ubuntu@YOUR_ORACLE_VM_PUBLIC_IP
```

Then browse to:

```text
http://localhost:8080
```

Install recommended plugins, then ensure these are available:

- Pipeline
- Git
- Docker Pipeline, required if using Docker agents
- GitHub integration, required if using GitHub webhooks

Create a strong admin password and disable public signup.

## GitHub Connection

Create the pipeline job:

1. In Jenkins, choose **New Item**.
2. Select **Pipeline** or **Multibranch Pipeline**.
3. Point it at the BlockHost GitHub repository.
4. Configure the script path as `Jenkinsfile`.
5. Add GitHub credentials if the repository is private.
6. Run the job manually once.

Optional webhook setup:

1. Install the Jenkins GitHub integration plugin.
2. Give Jenkins a stable protected URL, usually through Cloudflare Tunnel or a
   similar protected ingress.
3. In GitHub, add a repository webhook pointing at Jenkins.
4. Enable build-on-push behavior in the Jenkins job.

For private repositories, use a GitHub deploy key or a limited-scope personal
access token stored in Jenkins credentials.

## Expected CI Validation

A successful Jenkins build should run:

- Checkout
- Backend install
- Backend Prisma generate
- Backend tests
- Backend typecheck
- Backend build
- Frontend install
- Frontend typecheck
- Frontend build

The pipeline uses Node 20 Docker images and placeholder CI environment values.
It does not require Firebase Admin credentials, Cloudflare R2 credentials, or a
real Neon production database. Backend route tests use mocks.

## What Jenkins Should Not Do Yet

- Do not store production secrets yet.
- Do not deploy to Render.
- Do not deploy to Firebase Hosting.
- Do not run Prisma migrations against production.
- Do not expose Jenkins publicly without protection.
- Do not run untrusted pull request code with secrets.
- Do not connect Jenkins to deployment automation until CD is intentionally
  designed.

Render and Firebase remain the intended production deployment targets. Jenkins
is CI-only for now.

## Troubleshooting

Docker permission denied:

- If Jenkins cannot run Docker agents, confirm whether the Docker socket is
  mounted.
- Confirm the Jenkins container can access `/var/run/docker.sock`.
- Remember that mounting the socket is a security tradeoff.

Node image pull issues:

- Confirm the VM has outbound internet access.
- Run `docker pull node:20-alpine` on the VM.
- Check disk space if image pulls fail partway through.

Prisma generate requires `DATABASE_URL`:

- The Jenkinsfile sets a dummy `DATABASE_URL` for Prisma Client generation.
- CI should not connect to production Neon.
- CI should not run `prisma migrate dev` or `prisma migrate deploy`.

Low disk space:

- Docker images, build layers, and workspaces can grow quickly.
- Check usage with `df -h` and `docker system df`.
- Clean old Docker data carefully with `docker system prune`.
- Back up `jenkins_home` before aggressive cleanup.

Jenkins cannot access a private GitHub repository:

- Add GitHub credentials in Jenkins.
- Use a deploy key or limited-scope token.
- Confirm the job is using those credentials for checkout.
- Confirm the VM can reach GitHub over HTTPS or SSH.
