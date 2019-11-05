"! This is demo for converting JSON structure into
"! ABAP type
"! done by Lukasz Pegiel for http://abapblog.com
*This paprogram is subject to the apache v2 licence http://www.apache.org/licenses/
REPORT ZAPIDUMMYTESTPROG1.
include ZAPIDUMMYTESTPROG1TOP.



SELECTION-SCREEN BEGIN OF SCREEN 1001.

PARAMETERS: p_none   RADIOBUTTON GROUP gr1,
            p_low    RADIOBUTTON GROUP gr1,
            p_camel  RADIOBUTTON GROUP gr1,
            p_ext    RADIOBUTTON GROUP gr1 DEFAULT 'X',
            p_user   RADIOBUTTON GROUP gr1,
            p_userlo RADIOBUTTON GROUP gr1.

SELECTION-SCREEN END OF SCREEN 1001.

CLASS lcl_json_structure DEFINITION DEFERRED.
CLASS lcl_hlp DEFINITION.
  PUBLIC SECTION.
    TYPES: BEGIN OF t_source,
             line TYPE char255,
           END OF t_source.
    TYPES: tt_source TYPE STANDARD TABLE OF t_source WITH DEFAULT KEY.
    DATA: converter     TYPE REF TO lcl_json_structure,
          results       TYPE string,
          source_editor TYPE REF TO cl_gui_textedit,
          abap_editor   TYPE REF TO cl_wb_editor.
    METHODS: constructor.
    METHODS: create_source_editor.
    METHODS: convert.
    METHODS: pai IMPORTING VALUE(i_okcode) TYPE sy-ucomm,
      save_editor.
  PRIVATE SECTION.

    METHODS update_editor
      IMPORTING
        i_source TYPE tt_source.
    METHODS call_editor
      CHANGING
        c_source TYPE tt_source.
    METHODS pretty_print_code
      CHANGING
        c_source TYPE tt_source.
    METHODS get_pretty_name_mode.
    DATA: handler TYPE REF TO cl_wb_editor,
          pretty_name_mode type char1 value /ui2/cl_json=>pretty_mode-extended.

ENDCLASS.

CLASS lcl_json_structure DEFINITION.

  PUBLIC SECTION.

    TYPES: BEGIN OF t_hierarchy,
             level           TYPE i,
             name            TYPE string,
             table           TYPE abap_bool,
             structure       TYPE abap_bool,
             type            TYPE string,
             length          TYPE i,
             decimals        TYPE i,
             absolute_type   TYPE  abap_abstypename,
             parent          TYPE string,
             final_type      TYPE string,
             type_definition TYPE string,
             id              TYPE i,
           END OF t_hierarchy,
           tt_hierarchy TYPE STANDARD TABLE OF t_hierarchy WITH DEFAULT KEY.
    CONSTANTS: c_components TYPE string VALUE '&&components&&'.
    DATA: hierarchy TYPE tt_hierarchy.

    METHODS: build_structure IMPORTING i_data TYPE REF TO data
                             EXPORTING e_data TYPE string.
  PRIVATE SECTION.
    DATA: current_id TYPE i.
    METHODS check_component
      IMPORTING
        i_comp          TYPE abap_compdescr
        VALUE(i_data)   TYPE REF TO data
        VALUE(i_parent) TYPE  abap_abstypename
        i_level         TYPE i
        i_keep_level    TYPE abap_bool DEFAULT abap_false
        i_keep_id       TYPE abap_bool DEFAULT abap_false.
    METHODS check_object
      IMPORTING
        VALUE(i_data)   TYPE REF TO data
        VALUE(i_parent) TYPE  abap_abstypename
        i_abap_type     TYPE REF TO cl_abap_structdescr
        i_level         TYPE i.
    METHODS create_types RETURNING VALUE(r_definition) TYPE string.
    METHODS: get_id RETURNING VALUE(r_id) TYPE i.
    METHODS: display.
    METHODS: get_types RETURNING VALUE(r_types) TYPE string,
      init,
      get_internal_types
        CHANGING
          VALUE(c_type) TYPE t_hierarchy.
ENDCLASS.


START-OF-SELECTION.
  DATA(hlp) = NEW lcl_hlp( ).

  CALL SCREEN 0100.




*&---------------------------------------------------------------------*
*&      Module  PBO  OUTPUT
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
MODULE pbo OUTPUT.
  SET PF-STATUS 'STATUS_0100'.
  SET TITLEBAR 'TITLE'.
  hlp->create_source_editor( ).
ENDMODULE.
*&---------------------------------------------------------------------*
*&      Module  PAI  INPUT
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
MODULE pai INPUT.
  hlp->pai( ok_code ).
ENDMODULE.

CLASS lcl_hlp IMPLEMENTATION.

  METHOD constructor.
    converter = NEW #( ).
  ENDMETHOD.

  METHOD create_source_editor.
    IF source_editor IS INITIAL.
      source_editor = NEW #( parent =  NEW cl_gui_docking_container( side = cl_gui_docking_container=>dock_at_left
                                                                     no_autodef_progid_dynnr = abap_true
                                                           extension = 500 ) ) .
    ENDIF.
  ENDMETHOD.

  METHOD convert.
    DATA: source TYPE soli_tab.
    source_editor->get_text_as_stream(
      IMPORTING
        text                   =  source
      EXCEPTIONS
        error_cntl_call_method = 1
        OTHERS                 = 3
    ).
    IF sy-subrc EQ 0.

      DATA(json_data) = /ui2/cl_json=>generate( json = cl_bcs_convert=>txt_to_string( it_soli   = source ) pretty_name = pretty_name_mode ).
      IF json_data IS INITIAL.
        MESSAGE s001(00) WITH 'Problem converting JSON.' DISPLAY LIKE 'E' ##MG_MISSING ##NO_TEXT.
      ELSE.

        converter->build_structure(
          EXPORTING
            i_data = json_data
          IMPORTING
            e_data = results
        ).

        DATA: target TYPE STANDARD TABLE OF t_source.
        SPLIT results AT cl_abap_char_utilities=>newline INTO TABLE target.
        pretty_print_code( CHANGING c_source = target ).

        IF abap_editor IS INITIAL.
          call_editor( CHANGING c_source = target ).
        ELSE.
          update_editor( target ).
        ENDIF.
      ENDIF.
    ENDIF.
  ENDMETHOD.

  METHOD update_editor.

    abap_editor->get_source_instance( IMPORTING source_object = DATA(source_object) ).
    source_object->set_source_tab( i_source ).
    abap_editor->visualize_source(
      EXCEPTIONS
        initializing_error = 1
        OTHERS             = 2
    ).
    IF sy-subrc EQ 0.
      MESSAGE s001(00) WITH 'JSON converted.' ##MG_MISSING ##NO_TEXT.
    ENDIF.

  ENDMETHOD.



  METHOD call_editor.

    CALL FUNCTION 'EDITOR_APPLICATION'
      EXPORTING
        application        = 'TT'
        name               = space
        new                = 'X'
        title_text         = 'JSON2ABAPType'
        callback_program   = sy-repid
        callback_usercom   = 'CALLBACK_USERCOMM'
        callback_set_pfkey = 'CALLBACK_SET_PFKEY'
      TABLES
        content            = c_source
      EXCEPTIONS
        line               = 0
        linenumbers        = 0
        offset             = 0
        OTHERS             = 0.

  ENDMETHOD.



  METHOD pretty_print_code.

    CALL FUNCTION 'PRETTY_PRINTER'
      EXPORTING
        inctoo             = abap_false  " X = Process Include Programs as Well
      TABLES
        ntext              = c_source " Table of Formatted Source Code
        otext              = c_source   " Table of Source Code Pending Editing
      EXCEPTIONS
        enqueue_table_full = 0
        include_enqueued   = 0
        include_readerror  = 0
        include_writeerror = 0
        OTHERS             = 0.
  ENDMETHOD.



  METHOD pai.
    CLEAR sy-ucomm.
    CASE i_okcode.
      WHEN 'BACK' OR 'UP' OR 'EXIT'.
        LEAVE PROGRAM.
      WHEN 'CONVERT'.
        get_pretty_name_mode( ).
        convert( ).
    ENDCASE.
  ENDMETHOD.


  METHOD save_editor.
    FIELD-SYMBOLS:  <abap_editor>   TYPE REF TO cl_wb_tbeditor.
    ASSIGN  ('(SAPLS38E)ABAP_TBEDITOR') TO <abap_editor>.
    abap_editor = <abap_editor>->abap_editor.
  ENDMETHOD.


  METHOD get_pretty_name_mode.
    CALL SELECTION-SCREEN 1001.
    pretty_name_mode = cond #( when p_none eq abap_true then /ui2/cl_json=>pretty_mode-none
                               when p_camel eq abap_true then /ui2/cl_json=>pretty_mode-camel_case
                               when p_ext eq abap_true then /ui2/cl_json=>pretty_mode-extended
                               when p_low eq abap_true then /ui2/cl_json=>pretty_mode-low_case
*                               when p_user eq abap_true then /ui2/cl_json=>pretty_mode-user
*                               when p_userlo eq abap_true then /ui2/cl_json=>pretty_mode-user_low_case
                               else /ui2/cl_json=>pretty_mode-extended
                                 ).
  ENDMETHOD.

ENDCLASS.


CLASS lcl_json_structure IMPLEMENTATION.
  METHOD get_id.
    ADD 1 TO current_id.
    r_id = current_id.
  ENDMETHOD.
  METHOD build_structure.
    init( ).
    DATA: level TYPE i VALUE 0.
    DATA(abap_type) = CAST cl_abap_structdescr( cl_abap_structdescr=>describe_by_data_ref( p_data_ref = i_data ) ).
    APPEND VALUE #( level = level name = 'JSON' type = abap_type->type_kind absolute_type = abap_type->absolute_name structure = abap_true id = get_id( ) ) TO hierarchy.
    check_object( i_abap_type = abap_type i_level = level i_data = i_data i_parent = '' ).
    e_data = create_types( ).
  ENDMETHOD.

  METHOD init.

    REFRESH: hierarchy.
    CLEAR current_id.

  ENDMETHOD.

  METHOD display.
    cl_demo_output=>display( create_types( ) ).
  ENDMETHOD.
  METHOD check_object.

    LOOP AT i_abap_type->components ASSIGNING FIELD-SYMBOL(<comp>).
      DATA(field) = |i_data->{ <comp>-name }|.
      ASSIGN (field) TO FIELD-SYMBOL(<data>).
      IF <data> IS ASSIGNED AND <data> IS NOT INITIAL.

        check_component(
              i_parent = i_abap_type->absolute_name
              i_comp = <comp>
              i_data = <data>
              i_level = i_level ).

      ENDIF.
      UNASSIGN <data>.
    ENDLOOP.

  ENDMETHOD.                                             "#EC CI_VALPAR

  METHOD check_component.

    DATA level TYPE i VALUE 0.
    IF i_keep_level EQ abap_false.
      level = i_level + 1.
    ELSE.
      level = i_level.
    ENDIF.
    TRY.
        DATA(str_type) = CAST cl_abap_structdescr(  cl_abap_structdescr=>describe_by_data_ref( p_data_ref  = i_data ) ).

        check_object( i_parent = i_parent
                      i_data  = i_data
                      i_abap_type = str_type
                      i_level     = level
                     ).
        APPEND VALUE #( level = level name = i_comp-name type = str_type->type_kind absolute_type = str_type->absolute_name parent = i_parent structure = abap_true  id = get_id( ) ) TO hierarchy.
      CATCH cx_root.

        TRY.
            DATA(table_type) = CAST cl_abap_tabledescr( cl_abap_tabledescr=>describe_by_data_ref( p_data_ref = i_data ) ).
            IF i_keep_id EQ abap_false.
              DATA(id) = get_id( ).
              APPEND VALUE #( level = level name = i_comp-name type = table_type->type_kind absolute_type = table_type->absolute_name parent = i_parent table  = abap_true  id = id ) TO hierarchy.
            ELSE.
              id = current_id.
            ENDIF.

            FIELD-SYMBOLS: <tab>  TYPE STANDARD TABLE,
                           <test> TYPE any.
            ASSIGN i_data->* TO <tab>.
            TRY.
                ASSIGN <tab>[ 1 ] TO <test>.
                IF sy-subrc NE 0.
                  APPEND INITIAL LINE TO <tab> ASSIGNING <test>.
                ENDIF.
              CATCH cx_root.
                APPEND INITIAL LINE TO <tab> ASSIGNING <test>.
            ENDTRY.

            cl_abap_structdescr=>describe_by_data_ref( EXPORTING p_data_ref = <test>
                                                       RECEIVING p_descr_ref = DATA(table_line_ref)
                                                       EXCEPTIONS OTHERS = 1 ).
            IF sy-subrc NE 0.
              DATA: table_of_strings TYPE STANDARD TABLE OF string.
              check_component(
                EXPORTING
                  i_comp   = i_comp
                  i_data   = REF #( table_of_strings )
                  i_parent = i_parent
                  i_level  = i_level
                  i_keep_level = abap_true
                  i_keep_id  = abap_true
              ).
              RETURN.
            ENDIF.

            DATA(table_line_type) = CAST cl_abap_structdescr( table_line_ref  ).
            APPEND VALUE #( level = level name = i_comp-name type = table_line_type->type_kind absolute_type = table_line_type->absolute_name parent = table_type->absolute_name structure  = abap_true  id = id ) TO hierarchy.

            check_object( i_parent = table_type->absolute_name
                          i_data  = <test>
                          i_abap_type = table_line_type
                          i_level     = level
                        ).

          CATCH cx_root.
            "May be a table of strings or integers.
            IF table_type IS NOT INITIAL.
              TRY.
                  IF table_type->type_kind EQ 'h'.
                    DATA(table_line_as_el_type) = CAST cl_abap_elemdescr( cl_abap_elemdescr=>describe_by_data_ref( p_data_ref = <test> )  ).
                    ADD 1 TO level.
                    APPEND VALUE #( level = level name = i_comp-name type = table_line_as_el_type->type_kind absolute_type = table_line_as_el_type->absolute_name parent = table_line_as_el_type->absolute_name structure  = abap_true  id = id ) TO hierarchy.
                  ENDIF.
                CATCH cx_root.
                  TRY.
                      IF table_type->type_kind EQ 'h'.
                        table_line_as_el_type = CAST cl_abap_elemdescr( cl_abap_elemdescr=>describe_by_data( p_data = <test> )  ).
                        ADD 1 TO level.
                    APPEND VALUE #( level = level name = i_comp-name type = table_line_as_el_type->type_kind absolute_type = table_line_as_el_type->absolute_name parent = table_line_as_el_type->absolute_name structure  = abap_true  id = id ) TO hierarchy.
                      ENDIF.
                    CATCH cx_root.

                      DATA(other_type) =  cl_abap_typedescr=>describe_by_data_ref( p_data_ref  = i_data ) .
                      APPEND VALUE #( level = level name = i_comp-name type = other_type->type_kind length = other_type->length decimals = other_type->decimals absolute_type = other_type->absolute_name parent = i_parent ) TO hierarchy.
                  ENDTRY.

              ENDTRY.
            ELSE.
              other_type =  cl_abap_typedescr=>describe_by_data_ref( p_data_ref  = i_data ) .
              APPEND VALUE #( level = level name = i_comp-name type = other_type->type_kind length = other_type->length decimals = other_type->decimals absolute_type = other_type->absolute_name parent = i_parent ) TO hierarchy.
            ENDIF.
        ENDTRY.
    ENDTRY.
  ENDMETHOD.                                             "#EC CI_VALPAR

  METHOD create_types.
    DATA: components TYPE string.
    LOOP AT hierarchy ASSIGNING FIELD-SYMBOL(<h>).
      IF <h>-structure EQ abap_true AND <h>-type NE 'g'.
        <h>-final_type = |{ <h>-name } type t_{ <h>-name }{ <h>-id }| ##NO_TEXT.
        <h>-type_definition = |types: begin of t_{ <h>-name }{ <h>-id },{ cl_abap_char_utilities=>newline }{ c_components }end of t_{ <h>-name }{ <h>-id }.| ##NO_TEXT.
      ELSEIF <h>-structure EQ abap_true.
        <h>-final_type = |{ <h>-name } type t_{ <h>-name }{ <h>-id }| ##NO_TEXT.
        get_internal_types( CHANGING  c_type = <h> ).
        <h>-type_definition = |types: t_{ <h>-name }{ <h>-id } type { <h>-absolute_type }.| ##NO_TEXT.
      ELSEIF <h>-table EQ abap_true.
        <h>-final_type = |{ <h>-name } type tt_{ <h>-name }{ <h>-id }| ##NO_TEXT.
        <h>-type_definition = |types: tt_{ <h>-name }{ <h>-id } type standard table of t_{ <h>-name }{ <h>-id } with default key.| ##NO_TEXT.
      ELSE.

        get_internal_types( CHANGING  c_type = <h> ).
      ENDIF.
    ENDLOOP.

    LOOP AT hierarchy ASSIGNING <h> GROUP BY ( parent = <h>-parent ).
      CLEAR components.
      LOOP AT GROUP <h> ASSIGNING FIELD-SYMBOL(<g>).
        components = components && <g>-final_type && ',' && cl_abap_char_utilities=>newline.
      ENDLOOP.
      ASSIGN hierarchy[ absolute_type = <h>-parent ] TO FIELD-SYMBOL(<parent>).
      IF sy-subrc EQ 0.
        REPLACE ALL OCCURRENCES OF c_components IN <parent>-type_definition WITH components.
      ENDIF.
    ENDLOOP.

    SORT hierarchy BY level DESCENDING structure DESCENDING.
    LOOP AT hierarchy ASSIGNING <h> WHERE structure EQ abap_true
                                       OR table EQ abap_true.
      r_definition = r_definition && <h>-type_definition && cl_abap_char_utilities=>newline.
    ENDLOOP.
  ENDMETHOD.

  METHOD get_types.
    r_types = create_types( ).
  ENDMETHOD.

  METHOD get_internal_types.
    REPLACE FIRST OCCURRENCE OF REGEX '\\TYPE-POOL=(.*)\\TYPE=' IN c_type-absolute_type WITH ''.
    IF sy-subrc EQ 0.
      c_type-final_type = |{ c_type-name } type { c_type-absolute_type }|.
      RETURN.
    ELSE.
      REPLACE FIRST OCCURRENCE OF '\TYPE=' IN c_type-absolute_type WITH ' '.
    ENDIF.

    IF c_type-type EQ cl_abap_typedescr=>typekind_char.
      c_type-final_type = |{ c_type-name } type { c_type-absolute_type } length { c_type-length }|.
    ELSEIF c_type-type EQ cl_abap_typedescr=>typekind_packed.
      c_type-final_type = |{ c_type-name } type { c_type-absolute_type } length { c_type-length } decimals { c_type-decimals }|.
    ELSEIF c_type-type EQ cl_abap_typedescr=>typekind_num.
      c_type-final_type = |{ c_type-name } type { c_type-absolute_type } length { c_type-length }|.
    ELSE.
      c_type-final_type = |{ c_type-name } type { c_type-absolute_type }|.
    ENDIF.
  ENDMETHOD.                                             "#EC CI_VALPAR
ENDCLASS.

FORM callback_usercomm.
  hlp->pai( sy-ucomm ).
ENDFORM.


FORM callback_set_pfkey.
  SET PF-STATUS 'STATUS_0100'.
  SET TITLEBAR 'TITLE'.
  hlp->save_editor( ).
ENDFORM.
