*&---------------------------------------------------------------------*
*& Report ZAPIADT_TESTCASE_PROGRAM1
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ZAPIADT_TESTCASE_PROGRAM1.
INCLUDE zapiadt_testcase_include1.
IF foo IS BOUND. WRITE:/ 'bound'.ENDIF.
