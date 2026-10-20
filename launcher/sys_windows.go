//go:build windows

package main

import (
	"os/exec"
	"syscall"
	"unsafe"
)

// detach: on Windows the browser is a program of its own already.
func detach(cmd *exec.Cmd) {}

// setTitle names the console window, so it can be told apart behind the MaRQ window.
func setTitle(s string) {
	p, err := syscall.UTF16PtrFromString(s)
	if err != nil {
		return
	}
	syscall.NewLazyDLL("kernel32.dll").NewProc("SetConsoleTitleW").Call(uintptr(unsafe.Pointer(p)))
}
