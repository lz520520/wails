

all:
	go build -ldflags "-s -w" ./cmd/wails/
	mv wails $$GOPATH/bin

mac:
	GOOS=darwin go build -ldflags "-s -w" ./cmd/wails/