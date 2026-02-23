#!/bin/bash
# Service management helper script

case "$1" in
    start)
        systemctl --user start telegram-ssh-bot
        echo "Service started"
        ;;
    stop)
        systemctl --user stop telegram-ssh-bot
        echo "Service stopped"
        ;;
    restart)
        systemctl --user restart telegram-ssh-bot
        echo "Service restarted"
        ;;
    status)
        systemctl --user status telegram-ssh-bot
        ;;
    logs)
        journalctl --user -u telegram-ssh-bot -f
        ;;
    enable)
        systemctl --user enable telegram-ssh-bot
        echo "Service enabled for auto-start"
        ;;
    disable)
        systemctl --user disable telegram-ssh-bot
        echo "Service disabled from auto-start"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|enable|disable}"
        exit 1
        ;;
esac
