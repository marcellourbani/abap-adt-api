class zapiadt_testcase_class1 definition public create public .

  public section.



    interfaces zapiadt_testcase_intf1 .

    data lastx type string .

  private section.
    methods dosomethingprivate.
endclass.



class zapiadt_testcase_class1 implementation.


  method dosomethingprivate.

    data: lv_test type string.

    data(lv_test2) = lv_test.

  endmethod.


  method zapiadt_testcase_intf1~dosomething.
    data:fb type ref to zapidummyfoobar.
    y = x.
    translate y to upper case.
    lastx = x.
  endmethod.

endclass.