FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY ./apigee-ai-budgeting /app/apigee-ai-budgeting
COPY ./public /app/public
CMD ["/app/apigee-ai-budgeting"]
