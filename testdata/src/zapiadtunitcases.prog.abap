*
REPORT ZAPIADTUNITCASES.
CONSTANTS:cgreeting TYPE string VALUE 'Hello,world!'.


START-OF-SELECTION.

  WRITE:/ cgreeting.

FORM foo CHANGING greeting TYPE string.
  greeting = cgreeting.
ENDFORM.

FORM throw RAISING cx_abap_datfm.
  RAISE EXCEPTION TYPE cx_abap_datfm.
ENDFORM.

" now the dummy unit tests. Designed to test the API, not the actual program

CLASS lcl_test1 DEFINITION FOR TESTING INHERITING FROM cl_aunit_assert DURATION SHORT RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    METHODS:
      test_ok FOR TESTING,
      test_failure FOR TESTING.

ENDCLASS.

CLASS lcl_test1 IMPLEMENTATION.

  METHOD test_ok.
    DATA:g TYPE string.
    PERFORM foo CHANGING g.
    assert_equals( act = g exp = cgreeting ).
  ENDMETHOD.

  METHOD test_failure.
    DATA:g TYPE string.

    cl_aunit_warning_c=>create_by_id( param1 = 'TEST' ).

    PERFORM foo CHANGING g.
    assert_equals( act = g exp = 'FOO' ).
  ENDMETHOD.



ENDCLASS.

CLASS lcl_test2 DEFINITION FOR TESTING INHERITING FROM cl_aunit_assert DURATION SHORT RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    METHODS:
      test_ok FOR TESTING,
      test_failure FOR TESTING,
      test_exception FOR TESTING RAISING cx_abap_datfm,
      test_exception_form FOR TESTING RAISING cx_abap_datfm.

ENDCLASS.

CLASS lcl_test2 IMPLEMENTATION.

  METHOD test_ok.
    DATA:g TYPE string.
    PERFORM foo CHANGING g.
    assert_equals( act = g exp = cgreeting ).
  ENDMETHOD.

  METHOD test_failure.
    DATA:g TYPE string.
    PERFORM foo CHANGING g.

    assert_equals( act = g exp = 'FOO' ).
  ENDMETHOD.

  METHOD test_exception.
    RAISE EXCEPTION TYPE cx_abap_datfm.
  ENDMETHOD.

  METHOD test_exception_form.
    PERFORM throw.
  ENDMETHOD.

ENDCLASS.
