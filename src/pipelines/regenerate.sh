podman run --security-opt label=disable --rm   -v /var/home/user/Programming/ijs/omnihub/:/src   -w /src   sqlc/sqlc generate -f src/pipelines/sqlc.yml
