' ── Term Command Deck launcher ────────────────────────────────────────────
'
' What the desktop shortcut points at. It exists so that opening the deck is
' one double-click instead of a terminal and a typed command.
'
'   1. If the deck is already up, it just opens the browser. Double-clicking
'      the shortcut twice must not start a second pair of servers fighting
'      over the same two ports.
'   2. Otherwise it starts them with no console window, waits until Vite is
'      actually answering, and only then opens the browser — opening it any
'      earlier shows a connection error for a few seconds.
'   3. If they never come up, it says so rather than leaving you at a blank
'      tab wondering.

Option Explicit

Const URL          = "http://localhost:5173"
Const WAIT_SECONDS = 90

Dim shell, fso, here, root, i, started

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(here)

If Not Answering(URL) Then
  If Not fso.FolderExists(fso.BuildPath(root, "node_modules")) Then
    MsgBox "The deck's dependencies are not installed yet." & vbCrLf & vbCrLf & _
           "Open a terminal in" & vbCrLf & root & vbCrLf & "and run:  npm install", _
           vbExclamation, "Term Command Deck"
    WScript.Quit 1
  End If

  ' 0 = no window. The servers keep running after this script exits.
  shell.Run """" & fso.BuildPath(here, "start-deck.cmd") & """", 0, False
  started = True

  For i = 1 To WAIT_SECONDS * 2
    WScript.Sleep 500
    If Answering(URL) Then Exit For
  Next

  If Not Answering(URL) Then
    MsgBox "The deck did not come up within " & WAIT_SECONDS & " seconds." & vbCrLf & vbCrLf & _
           "Run launcher\start-deck.cmd directly to see what went wrong.", _
           vbExclamation, "Term Command Deck"
    WScript.Quit 1
  End If
End If

shell.Run URL, 1, False

' ── is anything listening on the client port yet? ─────────────────────────
' Short timeouts: while nothing is listening this is called twice a second,
' and the default timeouts would make the wait loop useless.
Function Answering(target)
  Dim http
  Answering = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  If Err.Number <> 0 Then
    ' No MSXML: assume it is up rather than blocking the launch outright.
    Answering = True
    Exit Function
  End If
  http.setTimeouts 800, 800, 1500, 1500
  http.Open "GET", target, False
  http.Send
  If Err.Number = 0 Then
    If http.Status >= 200 And http.Status < 500 Then Answering = True
  End If
  Err.Clear
  On Error GoTo 0
End Function
