// MaRQ launcher: serves the MaRQ folder on this computer (127.0.0.1 only) and opens MaRQ in a
// window of its own. It needs nothing installed; the analysis itself runs in the browser engine.
//
// The window is the application mode of Chrome or Edge (no address bar, no tabs; Edge comes
// with every Windows 10 and 11). Without either, MaRQ opens in a tab of the default browser.
//
// Build for every system with tools/build_launchers.py. Usage:
//
//	MaRQ.exe                 picks a free port from 8000 upward
//	MaRQ.exe 8080            a specific port
//	MaRQ.exe --dir PATH      serve another MaRQ folder
//	MaRQ.exe --tab           open a tab of the default browser instead of a window
//
// MARQ_NO_BROWSER=1 starts the server without opening a browser (tests); MARQ_BROWSER_TAB=1
// is the same as --tab.
package main

import (
	"bufio"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const version = "1.0"

// Content types are fixed here, never taken from the operating system: on some Windows
// machines the registry maps .js to text/plain, and browsers then refuse to start the
// analysis worker.
var types = map[string]string{
	".html": "text/html; charset=utf-8",
	".htm":  "text/html; charset=utf-8",
	".js":   "text/javascript; charset=utf-8",
	".mjs":  "text/javascript; charset=utf-8",
	".css":  "text/css; charset=utf-8",
	".json": "application/json",
	".svg":  "image/svg+xml",
	".png":  "image/png",
	".ico":  "image/x-icon",
	".wasm": "application/wasm",
	".py":   "text/plain; charset=utf-8",
	".txt":  "text/plain; charset=utf-8",
	".md":   "text/plain; charset=utf-8",
	".zip":  "application/zip",
	".whl":  "application/octet-stream",
	".tar":  "application/x-tar",
	".data": "application/octet-stream",
	".x3p":  "application/octet-stream",
}

// Windows keeps the console window open after a double-click only while the program runs,
// so every message that ends the program waits for Enter first.
func fail(msg string) {
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, msg)
	fmt.Fprintln(os.Stderr)
	fmt.Fprint(os.Stderr, "Press Enter to close this window.")
	bufio.NewReader(os.Stdin).ReadString('\n')
	os.Exit(1)
}

// The MaRQ folder: the given --dir, else the folder of this program, else its parent
// (the macOS and Linux launchers sit in software/launchers/).
func appDir(arg string) (string, error) {
	has := func(d string) bool {
		_, err := os.Stat(filepath.Join(d, "index.html"))
		_, err2 := os.Stat(filepath.Join(d, "worker.js"))
		return err == nil && err2 == nil
	}
	if arg != "" {
		if has(arg) {
			return filepath.Abs(arg)
		}
		return "", fmt.Errorf("%s is not a MaRQ folder (index.html and worker.js are missing)", arg)
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if r, err := filepath.EvalSymlinks(exe); err == nil {
		exe = r
	}
	here := filepath.Dir(exe)
	for _, d := range []string{here, filepath.Dir(here)} {
		if has(d) {
			return d, nil
		}
	}
	return "", errors.New("not found")
}

func listen(port int) (net.Listener, error) {
	if port > 0 {
		return net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	}
	for p := 8000; p < 8050; p++ {
		if l, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p)); err == nil {
			return l, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0") // any free port
}

// appBrowser finds a Chromium-based browser that can show a page as an application window.
func appBrowser() (string, bool) {
	switch runtime.GOOS {
	case "windows":
		var bases []string
		for _, v := range []string{"ProgramFiles", "ProgramFiles(x86)", "LocalAppData"} {
			if b := os.Getenv(v); b != "" {
				bases = append(bases, b)
			}
		}
		for _, rel := range []string{`Google\Chrome\Application\chrome.exe`, `Microsoft\Edge\Application\msedge.exe`,
			`BraveSoftware\Brave-Browser\Application\brave.exe`, `Chromium\Application\chrome.exe`} {
			for _, b := range bases {
				if p := filepath.Join(b, rel); fileExists(p) {
					return p, true
				}
			}
		}
	case "darwin":
		home, _ := os.UserHomeDir()
		for _, app := range []string{"Google Chrome.app", "Microsoft Edge.app", "Chromium.app", "Brave Browser.app"} {
			for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
				if p := filepath.Join(dir, app); fileExists(p) {
					return p, true
				}
			}
		}
	default:
		for _, b := range []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
			"microsoft-edge", "microsoft-edge-stable", "brave-browser"} {
			if p, err := exec.LookPath(b); err == nil {
				return p, true
			}
		}
	}
	return "", false
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// openWindow shows MaRQ in an application window; false when no suitable browser is found.
func openWindow(url string) bool {
	p, ok := appBrowser()
	if !ok {
		return false
	}
	args := []string{"--app=" + url, "--start-maximized"}
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", append([]string{"-na", p, "--args"}, args...)...)
	} else {
		cmd = exec.Command(p, args...)
	}
	return cmd.Start() == nil
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		for _, b := range []string{"xdg-open", "gio", "sensible-browser", "firefox", "google-chrome", "chromium"} {
			if p, err := exec.LookPath(b); err == nil {
				if b == "gio" {
					cmd = exec.Command(p, "open", url)
				} else {
					cmd = exec.Command(p, url)
				}
				break
			}
		}
		if cmd == nil {
			return errors.New("no browser command found")
		}
	}
	return cmd.Start()
}

type handler struct{ root string }

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	p := r.URL.Path
	if p == "/" {
		p = "/index.html"
	}
	if strings.Contains(p, "..") {
		http.NotFound(w, r)
		return
	}
	full := filepath.Join(h.root, filepath.FromSlash(strings.TrimPrefix(p, "/")))
	f, err := os.Open(full)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}
	ct, ok := types[strings.ToLower(filepath.Ext(full))]
	if !ok {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

func main() {
	port, dirArg, tab := 0, "", os.Getenv("MARQ_BROWSER_TAB") != ""
	args := os.Args[1:]
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--dir" && i+1 < len(args):
			dirArg = args[i+1]
			i++
		case a == "--tab":
			tab = true
		case a == "-h" || a == "--help":
			fmt.Println("MaRQ launcher " + version + ": serves the MaRQ folder on 127.0.0.1 and opens MaRQ in its own window.")
			fmt.Println("Usage: MaRQ [port] [--dir FOLDER] [--tab]")
			return
		default:
			n, err := strconv.Atoi(a)
			if err != nil || n < 1 || n > 65535 {
				fail("Unknown argument: " + a + "\nUsage: MaRQ [port] [--dir FOLDER] [--tab]")
			}
			port = n
		}
	}

	root, err := appDir(dirArg)
	if err != nil {
		if dirArg != "" {
			fail(err.Error())
		}
		fail("The MaRQ files (index.html, worker.js) are not next to this program.\n\n" +
			"If you opened the downloaded zip file directly, extract it first\n" +
			"(Windows: right-click the zip, Extract All; macOS: double-click the zip),\n" +
			"then start MaRQ from the extracted \"software\" folder.")
	}

	l, err := listen(port)
	if err != nil {
		fail(fmt.Sprintf("Port %d is in use or not allowed (%v).\nStart MaRQ without a port number, or with another one.", port, err))
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/", l.Addr().(*net.TCPAddr).Port)

	fmt.Println("MaRQ " + version + ", the Microchannel and Replication Quality Analyzer")
	fmt.Println()
	fmt.Println("  MaRQ is running at   " + url)
	fmt.Println("  Folder               " + root)
	fmt.Println()
	fmt.Println("  Keep this window open while you use MaRQ; close it to stop MaRQ.")
	fmt.Println("  Nothing is installed and no data leave this computer: the analysis runs in")
	fmt.Println("  your browser, this program only hands it the files of the MaRQ folder.")
	fmt.Println()

	srv := &http.Server{Handler: handler{root}, ReadHeaderTimeout: 30 * time.Second}
	go func() {
		if err := srv.Serve(l); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fail("The server stopped: " + err.Error())
		}
	}()

	if os.Getenv("MARQ_NO_BROWSER") == "" {
		time.Sleep(300 * time.Millisecond)
		if !tab && openWindow(url) {
			fmt.Println("  MaRQ opens in its own window now. If it does not, open Chrome, Edge,")
			fmt.Println("  Firefox or Safari yourself and go to   " + url)
		} else if err := openBrowser(url); err != nil {
			fmt.Println("  The browser could not be opened automatically. Open Chrome, Edge, Firefox")
			fmt.Println("  or Safari yourself and go to   " + url)
		} else {
			fmt.Println("  Your browser should open MaRQ now. If it does not, open Chrome, Edge,")
			fmt.Println("  Firefox or Safari yourself and go to   " + url)
		}
		fmt.Println()
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
	fmt.Println("\nMaRQ stopped.")
	srv.Close()
}
