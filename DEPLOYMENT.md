# Deployment

The production container is defined by `Dockerfile.vps` and
`docker-compose.vps.yml`.

The application can be started without Traefik for a local preflight:

    TRAEFIK_ENABLE=false docker compose -f docker-compose.vps.yml up -d --build

Verify the local service:

    docker compose -f docker-compose.vps.yml ps
    curl -fsS http://127.0.0.1:8788/api/health
    curl -I http://127.0.0.1:8788/

When the replacement is verified, stop the previous Ghost container and enable
the Traefik router:

    docker stop dpg
    TRAEFIK_ENABLE=true docker compose -f docker-compose.vps.yml up -d

To roll back, disable the new router and restart Ghost:

    TRAEFIK_ENABLE=false docker compose -f docker-compose.vps.yml up -d
    docker start dpg

Do not run `docker compose down -v` against the DPG deployment. The named
volume contains the persistent application state.
