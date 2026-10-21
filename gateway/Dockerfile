FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gateway .

FROM alpine:3.20
RUN adduser -D -u 1000 app && apk add --no-cache ca-certificates
COPY --from=build /out/gateway /gateway
ENV PORT=8080
EXPOSE 8080
USER app
ENTRYPOINT ["/gateway"]