<!DOCTYPE document SYSTEM "chrome://liberator/content/liberator.dtd">

<xsl:stylesheet version="1.0"
    xmlns="http://vimperator.org/namespaces/liberator"
    xmlns:liberator="http://vimperator.org/namespaces/liberator"
    xmlns:html="http://www.w3.org/1999/xhtml"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:str="http://exslt.org/strings"
    extension-element-prefixes="str">

    <xsl:variable name="local" select="concat('chrome://&liberator.name;/locale/', /liberator:document/@name, '.xml')"/>
    <xsl:variable name="localdoc" select="document($local)/liberator:overlay"/>

    <xsl:template match="liberator:document">
        <xsl:copy>
            <xsl:apply-templates/>
        </xsl:copy>
    </xsl:template>

    <xsl:template name="splice-locals">
        <xsl:param name="elem"/>
        <xsl:param name="tag"/>
        <xsl:for-each select="$localdoc/*[@insertbefore=$tag]">
            <xsl:apply-templates select="."/>
        </xsl:for-each>
        <xsl:choose>
            <xsl:when test="$localdoc/*[@replace=$tag] and not($elem[@replace])">
                <xsl:for-each select="$localdoc/*[@replace=$tag]">
                    <xsl:apply-templates select="." mode="pass-2"/>
                </xsl:for-each>
            </xsl:when>
            <xsl:otherwise>
                <xsl:for-each select="$elem">
                    <xsl:apply-templates select="." mode="pass-2"/>
                </xsl:for-each>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:for-each select="$localdoc/*[@insertafter=$tag]">
            <xsl:apply-templates select="."/>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="liberator:document/liberator:tags|liberator:document/liberator:tag">
        <xsl:call-template name="splice-locals">
            <xsl:with-param name="tag" select="substring-before(concat(., ' '), ' ')"/>
            <xsl:with-param name="elem" select="self::node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="liberator:document/*[liberator:tags]">
        <xsl:call-template name="splice-locals">
            <xsl:with-param name="tag" select="substring-before(concat(liberator:tags, ' '), ' ')"/>
            <xsl:with-param name="elem" select="self::node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="liberator:*[@tag and not(@replace)]">
        <xsl:call-template name="splice-locals">
            <xsl:with-param name="tag" select="substring-before(concat(@tag, ' '), ' ')"/>
            <xsl:with-param name="elem" select="self::node()"/>
        </xsl:call-template>
    </xsl:template>

    <xsl:template match="@*|node()" mode="pass-2">
        <xsl:copy>
            <xsl:apply-templates select="@*|node()"/>
        </xsl:copy>
    </xsl:template>
    <xsl:template match="@*|node()">
        <xsl:apply-templates select="." mode="pass-2"/>
    </xsl:template>
</xsl:stylesheet>

<!-- vim:se ft=xslt sts=4 sw=4 et: -->
