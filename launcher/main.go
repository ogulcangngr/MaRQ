// MaRQ launcher: serves the MaRQ folder on this computer (127.0.0.1 only) and opens MaRQ in a
// window of its own. It needs nothing installed; the analysis itself runs in the browser engine.
//
// The window is the application mode of Chrome or Edge (no address bar, no tabs; Edge comes
// with every Windows 10 and 11). Without either, MaRQ opens in a tab of the default browser.
//
// Build for every system with tools/build_launchers.py. Usage:
//
//	MaRQ.exe                 picks a free port from 8000 upward; if MaRQ already runs from
//	                         this folder, opens a window to it instead of a second server
//	MaRQ.exe 8080            a specific port
//	MaRQ.exe --dir PATH      serve another MaRQ folder
//	MaRQ.exe --tab           open a tab of the default browser instead of a window
//	MaRQ.exe --stay          keep running after the last MaRQ window has closed
//
// MaRQ stops, and its console window closes, a few seconds after its last window has closed:
// every MaRQ page says it is alive every 20 s and goodbye when it closes (a reload says hello
// again within the few seconds).
//
// MARQ_NO_BROWSER=1 starts the server without opening a browser (tests); MARQ_BROWSER_TAB=1
// is the same as --tab.
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
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

// listen takes the first free port from 8000 upward. A port held by MaRQ serving this same
// folder is returned as a URL instead, so the caller opens a window to that MaRQ: a second
// double-click does not start a second server on another port (where the settings, which the
// browser remembers per port, would be missing).
func listen(port int, root string) (net.Listener, string, error) {
	if port > 0 {
		l, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
		return l, "", err
	}
	for p := 8000; p < 8050; p++ {
		if l, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p)); err == nil {
			return l, "", nil
		}
		if u := runningMaRQ(p, root); u != "" {
			return nil, u, nil
		}
	}
	l, err := net.Listen("tcp", "127.0.0.1:0") // any free port
	return l, "", err
}

// identity answers /__marq, so a later start can recognise this server.
type identity struct {
	App     string `json:"app"`
	Version string `json:"version"`
	Dir     string `json:"dir"`
}

func runningMaRQ(port int, root string) string {
	u := fmt.Sprintf("http://127.0.0.1:%d/", port)
	c := http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := c.Get(u + "__marq")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var id identity
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&id) != nil || id.App != "MaRQ" {
		return ""
	}
	a, b := filepath.Clean(id.Dir), filepath.Clean(root)
	if a == b || (runtime.GOOS != "linux" && strings.EqualFold(a, b)) {
		return u
	}
	return ""
}

// The browsers that can show a page as an application window, in order of preference; the
// default browser of the user comes first when it is one of them.
type browser struct {
	key   string
	paths []string
}

func browsers() []browser {
	var list []browser
	switch runtime.GOOS {
	case "windows":
		var bases []string
		for _, v := range []string{"ProgramFiles", "ProgramFiles(x86)", "LocalAppData"} {
			if b := os.Getenv(v); b != "" {
				bases = append(bases, b)
			}
		}
		for _, kr := range [][2]string{{"chrome", `Google\Chrome\Application\chrome.exe`}, {"edge", `Microsoft\Edge\Application\msedge.exe`},
			{"brave", `BraveSoftware\Brave-Browser\Application\brave.exe`}, {"chromium", `Chromium\Application\chrome.exe`}} {
			b := browser{key: kr[0]}
			for _, base := range bases {
				b.paths = append(b.paths, filepath.Join(base, kr[1]))
			}
			list = append(list, b)
		}
	case "darwin":
		home, _ := os.UserHomeDir()
		for _, kr := range [][2]string{{"chrome", "Google Chrome.app"}, {"edge", "Microsoft Edge.app"},
			{"chromium", "Chromium.app"}, {"brave", "Brave Browser.app"}} {
			list = append(list, browser{kr[0], []string{filepath.Join("/Applications", kr[1]), filepath.Join(home, "Applications", kr[1])}})
		}
	default:
		for _, kr := range [][2]string{{"chrome", "google-chrome"}, {"chrome", "google-chrome-stable"}, {"chromium", "chromium"},
			{"chromium", "chromium-browser"}, {"edge", "microsoft-edge"}, {"edge", "microsoft-edge-stable"}, {"brave", "brave-browser"}} {
			if p, err := exec.LookPath(kr[1]); err == nil {
				list = append(list, browser{kr[0], []string{p}})
			}
		}
	}
	if d := defaultBrowser(); d != "" {
		var first, rest []browser
		for _, b := range list {
			if b.key == d {
				first = append(first, b)
			} else {
				rest = append(rest, b)
			}
		}
		list = append(first, rest...)
	}
	return list
}

// defaultBrowser names the default web browser when it is Chromium-based ("" otherwise, or
// when unknown): from the Windows registry, or from xdg-settings on Linux.
func defaultBrowser() string {
	var out []byte
	switch runtime.GOOS {
	case "windows":
		out, _ = exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice`, "/v", "ProgId").Output()
	case "linux":
		out, _ = exec.Command("xdg-settings", "get", "default-web-browser").Output()
	}
	s := strings.ToLower(string(out))
	switch {
	case strings.Contains(s, "chromehtml") || strings.Contains(s, "google-chrome"):
		return "chrome"
	case strings.Contains(s, "msedgehtm") || strings.Contains(s, "microsoft-edge"):
		return "edge"
	case strings.Contains(s, "brave"):
		return "brave"
	case strings.Contains(s, "chromium"):
		return "chromium"
	}
	return ""
}

// appBrowser finds a Chromium-based browser that can show a page as an application window.
func appBrowser() (string, bool) {
	for _, b := range browsers() {
		for _, p := range b.paths {
			if fileExists(p) {
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
	args := []string{"--app=" + url, "--start-maximized", "--no-first-run", "--no-default-browser-check"}
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", append([]string{"-na", p, "--args"}, args...)...)
	} else {
		cmd = exec.Command(p, args...)
	}
	detach(cmd) // Ctrl+C or closing the terminal stops MaRQ, not the browser
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
	detach(cmd)
	return cmd.Start()
}

type handler struct {
	root  string
	port  int
	pages *pages
}

// pages tracks the open MaRQ windows.
type pages struct {
	mu    sync.Mutex
	seen  map[string]time.Time
	ever  bool
	empty time.Time
}

func (ps *pages) alive(id string) {
	ps.mu.Lock()
	ps.seen[id] = time.Now()
	ps.ever = true
	ps.mu.Unlock()
}

func (ps *pages) bye(id string) {
	ps.mu.Lock()
	delete(ps.seen, id)
	ps.mu.Unlock()
}

// watch returns once no MaRQ page has been open for the grace time. A page that stopped saying
// it is alive without a goodbye (a crashed browser) is dropped after five minutes; a hidden
// page still says it every minute at least.
func (ps *pages) watch(grace time.Duration) {
	for range time.Tick(time.Second) {
		ps.mu.Lock()
		now := time.Now()
		for id, t := range ps.seen {
			if now.Sub(t) > 5*time.Minute {
				delete(ps.seen, id)
			}
		}
		done := false
		if !ps.ever || len(ps.seen) > 0 {
			ps.empty = time.Time{}
		} else if ps.empty.IsZero() {
			ps.empty = now
		} else if now.Sub(ps.empty) >= grace {
			done = true
		}
		ps.mu.Unlock()
		if done {
			return
		}
	}
}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// only requests for this server by its own name: a web page that points another host name
	// at 127.0.0.1 (DNS rebinding) cannot read the folder
	if r.Host != "127.0.0.1:"+strconv.Itoa(h.port) && r.Host != "localhost:"+strconv.Itoa(h.port) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	p := r.URL.Path
	if r.Method == http.MethodPost && (p == "/__alive" || p == "/__bye") {
		if id := r.URL.Query().Get("id"); id != "" && len(id) < 100 {
			if p == "/__alive" {
				h.pages.alive(id)
			} else {
				h.pages.bye(id)
			}
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if p == "/" {
		p = "/index.html"
	}
	if p == "/__marq" {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(identity{"MaRQ", version, h.root})
		return
	}
	for _, seg := range strings.Split(p, "/") {
		if strings.HasPrefix(seg, ".") || strings.Contains(seg, `\`) { // "..", hidden files (.git)
			http.NotFound(w, r)
			return
		}
	}
	full := filepath.Join(h.root, filepath.FromSlash(strings.TrimPrefix(p, "/")))
	f, err := os.Open(full)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	ct, ok := types[strings.ToLower(filepath.Ext(full))]
	if !ok {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	// The browser asks again every time and gets the file unless it holds exactly this one: the
	// tag names the size and the modification time. A date comparison alone is not used, since a
	// folder extracted from an older zip has older dates than the files the browser may hold
	// from another MaRQ that was served on the same port.
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("ETag", fmt.Sprintf(`"%x-%x"`, st.Size(), st.ModTime().UnixNano()))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	r.Header.Del("If-Modified-Since")
	r.Header.Del("If-Unmodified-Since")
	http.ServeContent(w, r, st.Name(), time.Time{}, f)
}

func main() {
	port, dirArg, tab, stay := 0, "", os.Getenv("MARQ_BROWSER_TAB") != "", false
	args := os.Args[1:]
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--dir" && i+1 < len(args):
			dirArg = args[i+1]
			i++
		case a == "--tab":
			tab = true
		case a == "--stay":
			stay = true
		case a == "-h" || a == "--help":
			fmt.Println("MaRQ launcher " + version + ": serves the MaRQ folder on 127.0.0.1 and opens MaRQ in its own window.")
			fmt.Println("Usage: MaRQ [port] [--dir FOLDER] [--tab] [--stay]")
			return
		default:
			n, err := strconv.Atoi(a)
			if err != nil || n < 1 || n > 65535 {
				fail("Unknown argument: " + a + "\nUsage: MaRQ [port] [--dir FOLDER] [--tab] [--stay]")
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
			"- If you opened the downloaded zip file directly, extract it first\n" +
			"  (Windows: right-click the zip, Extract All; macOS: double-click the zip),\n" +
			"  then start MaRQ from the extracted folder.\n" +
			"- If this program was copied somewhere else (the Desktop, for example), start it\n" +
			"  from the MaRQ folder instead. For an icon on the Desktop, make a shortcut:\n" +
			"  right-click MaRQ.exe, Send to, Desktop (create shortcut).")
	}

	setTitle("MaRQ " + version + " - close this window to stop MaRQ")
	l, running, err := listen(port, root)
	if err != nil {
		fail(fmt.Sprintf("Port %d is in use or not allowed (%v).\nStart MaRQ without a port number, or with another one.", port, err))
	}
	if running != "" {
		fmt.Println("MaRQ is already running from this folder, at " + running)
		if os.Getenv("MARQ_NO_BROWSER") == "" && (tab || !openWindow(running)) {
			openBrowser(running)
		}
		fmt.Println("A new MaRQ window opens; this window closes by itself.")
		time.Sleep(4 * time.Second)
		return
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/", l.Addr().(*net.TCPAddr).Port)

	fmt.Println("MaRQ " + version + ", the Microchannel and Replication Quality Analyzer")
	fmt.Println()
	fmt.Println("  MaRQ is running at   " + url)
	fmt.Println("  Folder               " + root)
	fmt.Println()
	// tests start the server without a browser and keep it; MARQ_AUTOSTOP=seconds tests the stop
	grace := 4 * time.Second
	autoStop := !stay && os.Getenv("MARQ_NO_BROWSER") == ""
	if n, err := strconv.Atoi(os.Getenv("MARQ_AUTOSTOP")); err == nil && n > 0 {
		autoStop, grace = !stay, time.Duration(n)*time.Second
	}
	if autoStop {
		fmt.Println("  MaRQ stops, and this window closes, when its last window is closed;")
		fmt.Println("  closing this window stops MaRQ too.")
	} else {
		fmt.Println("  Keep this window open while you use MaRQ; close it to stop MaRQ.")
	}
	fmt.Println("  Nothing is installed and no data leave this computer: the analysis runs in")
	fmt.Println("  your browser, this program only hands it the files of the MaRQ folder.")
	fmt.Println()

	ps := &pages{seen: map[string]time.Time{}}
	srv := &http.Server{Handler: handler{root, l.Addr().(*net.TCPAddr).Port, ps}, ReadHeaderTimeout: 30 * time.Second}
	if autoStop {
		go func() {
			ps.watch(grace)
			fmt.Println("\nMaRQ stopped: its last window was closed.")
			srv.Close()
			os.Exit(0)
		}()
	}
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
