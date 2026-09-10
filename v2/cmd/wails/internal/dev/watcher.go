package dev

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/internal/fs"

	"github.com/fsnotify/fsnotify"
	gitignore "github.com/sabhiram/go-gitignore"
	"github.com/samber/lo"
)

type Watcher interface {
	Add(name string) error
}

// initialiseWatcher creates the project directory watcher that will trigger recompile
func initialiseWatcher(cwd, reloadDirs string) (*fsnotify.Watcher, *directoryIgnoreMatcher, error) {
	// Ignore dot files, node_modules and build directories by default
	ignoreMatcher := newDirectoryIgnoreMatcher(cwd, getIgnoreDirs(cwd))

	// Get all subdirectories
	dirs, err := fs.GetSubdirectories(cwd)
	if err != nil {
		return nil, nil, err
	}

	customDirs := dirs.AsSlice()
	seperatedDirs := strings.Split(reloadDirs, ",")
	for _, dir := range seperatedDirs {
		customSub, err := fs.GetSubdirectories(filepath.Join(cwd, dir))
		if err != nil {
			return nil, nil, err
		}
		customDirs = append(customDirs, customSub.AsSlice()...)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, nil, err
	}

	for _, dir := range processDirectories(customDirs, ignoreMatcher) {
		err := watcher.Add(dir)
		if err != nil {
			_ = watcher.Close()
			return nil, nil, err
		}
	}
	return watcher, ignoreMatcher, nil
}

func getIgnoreDirs(cwd string) []string {
	ignoreDirs := []string{"build/*", ".*", "node_modules"}
	baseDir := filepath.Base(cwd)
	// Read .gitignore into ignoreDirs
	f, err := os.Open(filepath.Join(cwd, ".gitignore"))
	if err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if line != baseDir {
				ignoreDirs = append(ignoreDirs, line)
			}
		}
	}

	return lo.Uniq(ignoreDirs)
}

type directoryIgnoreMatcher struct {
	root    string
	ignorer *gitignore.GitIgnore
}

func newDirectoryIgnoreMatcher(cwd string, ignoreDirs []string) *directoryIgnoreMatcher {
	root, err := filepath.Abs(cwd)
	if err != nil {
		root = filepath.Clean(cwd)
	}
	return &directoryIgnoreMatcher{
		root:    root,
		ignorer: gitignore.CompileIgnoreLines(ignoreDirs...),
	}
}

func (matcher *directoryIgnoreMatcher) Matches(dir string) bool {
	absolute, err := filepath.Abs(dir)
	if err != nil {
		return false
	}
	relative, err := filepath.Rel(matcher.root, absolute)
	if err != nil || relative == "." {
		return false
	}
	return matcher.ignorer.MatchesPath(filepath.ToSlash(relative))
}

func processDirectories(dirs []string, ignoreMatcher *directoryIgnoreMatcher) []string {
	return lo.Filter(dirs, func(dir string, _ int) bool {
		return !ignoreMatcher.Matches(dir)
	})
}
