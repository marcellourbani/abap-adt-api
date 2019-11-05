class ZAPIADT_TESTCASE_CLASS1 definition
  public
  create public .

public section.

  interfaces ZAPIADT_TESTCASE_INTF1 .

  data LASTX type STRING .

private section.
  methods dosomethingprivate.
ENDCLASS.



CLASS ZAPIADT_TESTCASE_CLASS1 IMPLEMENTATION.


method dosomethingprivate.

endmethod.


  METHOD zapiadt_testcase_intf1~dosomething.
    data:fb type ref to ZAPIDUMMYFOOBAR.
    y = x.
    TRANSLATE y TO UPPER CASE.
    lastx = x.
  ENDMETHOD.
ENDCLASS.
