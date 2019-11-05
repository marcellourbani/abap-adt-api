*&---------------------------------------------------------------------*
*& Report ZADTTESTINCLUDE1
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zadttestinclude1.
DATA:bar TYPE c.
INCLUDE zadttestincludeinc.

START-OF-SELECTION.
  PERFORM foo.
  CALL FUNCTION 'ZAPIDUMMYFOOFUNC'.
