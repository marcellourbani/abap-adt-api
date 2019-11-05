*"* use this source file for your ABAP unit test classes

CLASS ut DEFINITION FOR TESTING INHERITING FROM cl_aunit_assert DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    DATA cut TYPE REF TO zapiadt_testcase_class1.

    METHODS:setup,dosomething FOR TESTING.
ENDCLASS.

CLASS ut IMPLEMENTATION.


  METHOD dosomething.
    DATA: in TYPE string VALUE 'foobar'.
    assert_equals( act = cut->lastx exp = '' ).

    in = cut->zapiadt_testcase_intf1~dosomething( in ).

    assert_equals( act = in exp = 'FOOBAR' ).

    assert_equals( act = cut->lastx exp = 'FOOBAR' ).

  ENDMETHOD.

  METHOD setup.
    CREATE OBJECT cut.
  ENDMETHOD.
ENDCLASS.
