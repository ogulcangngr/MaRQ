//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// detach starts the browser in a session of its own, so Ctrl+C in the terminal or closing it
// stops MaRQ but not the browser windows.
func detach(cmd *exec.Cmd) { cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }

// setTitle names the terminal window, when there is one.
func setTitle(s string) {
	if fi, err := os.Stdout.Stat(); err == nil && fi.Mode()&os.ModeCharDevice != 0 {
		fmt.Printf("\033]0;%s\007", s)
	}
}
